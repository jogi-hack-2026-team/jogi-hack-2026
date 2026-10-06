import pg from 'pg';

export type AppPoolOptions = {
  connectionString: string;
  max?: number;
  /** 1クエリの応答を待つ上限（client側）。既定5秒。テストで短くする以外は変えない。 */
  queryTimeoutMs?: number;
  /** 1文の実行時間の上限（server側、`statement_timeout`）。既定5秒。 */
  statementTimeoutMs?: number;
};

// 接続確立・クエリ応答・文実行の上限はすべて5秒。health（select 1）とGoal・記録のCRUDは1往復の小さなクエリで、
// 予測の計算はDBを使わない。到達不能・応答停止のDBで要求が無期限に残らないよう、同じ桁の上限に揃える。
const DEFAULT_TIMEOUT_MS = 5_000;

// アプリ用の接続pool。int8はpgの既定（文字列）のまま。認証用poolの変換は#74で別に扱う。
function runtimePoolOptions(o: AppPoolOptions): pg.PoolConfig {
  return {
    connectionString: o.connectionString,
    max: o.max ?? 5,
    // 到達不能なDBでhealthが無期限に待たないよう、接続確立に上限を置く。
    connectionTimeoutMillis: DEFAULT_TIMEOUT_MS,
    // 接続後に応答が止まったDB（TCPは生きているが返事がない）で要求が完了しないことを防ぐ。
    // 期限を超えたclientはpoolが破棄し、再利用しない（pg-poolは失敗したclientをreleaseせず除去する）。
    query_timeout: o.queryTimeoutMs ?? DEFAULT_TIMEOUT_MS,
    // clientが諦めてもserver側の文は走り続けるため、server側でも同じ上限で打ち切る。
    statement_timeout: o.statementTimeoutMs ?? DEFAULT_TIMEOUT_MS,
    // 応答のない相手のsocketをOSのkeepaliveで検出し、破棄済みclientの接続が残り続けないようにする。
    keepAlive: true,
  };
}

export function createAppPool(o: AppPoolOptions): pg.Pool {
  const pool = new pg.Pool(runtimePoolOptions(o));
  pool.on('connect', (client) => protectRuntimeClient(client, 'app'));
  return pool;
}

// migrationはHTTPと別責務。lock待ちとDDLは5秒で中断せず、接続確立だけを制限する。
// 実行中の中止はoperatorが行う。DDLのtransactionは切断時にもrollbackされる。
export function createMigrationPool(o: { connectionString: string }): pg.Pool {
  const pool = new pg.Pool({
    connectionString: o.connectionString,
    max: 3,
    connectionTimeoutMillis: DEFAULT_TIMEOUT_MS,
    query_timeout: 0,
    // 接続URI/PGOPTIONSの他設定を保持し、ROLE/DB既定の期限だけ接続確立後に解除する。
    // 固定pg-poolはこのPromise完了までclientをcheckoutしない。
    onConnect: async (client) => { await client.query('set statement_timeout = 0'); },
    keepAlive: true,
  });
  pool.on('error', () => console.warn('migration: idle DB connection lost; affected client discarded'));
  return pool;
}

const INT8_OID = 20;

function discardTimedOutClient(client: pg.PoolClient, error: unknown): void {
  if (error instanceof Error && error.message === 'Query read timeout') void client.end();
}

// Goal storeとBetter Auth/Kyselyはpool.connect→client.query→release(errorなし)を使う。
// public end()で期限切れclientをending状態にし、release時に再利用されないようにする。
function protectRuntimeClient(client: pg.PoolClient, owner: 'app' | 'auth'): void {
  client.on('error', () => {
    void client.end();
    console.warn(`${owner}: DB connection lost; affected client discarded`);
  });
  const query = client.query;
  client.query = function (...args: unknown[]) {
    const callback = args.at(-1);
    if (typeof callback === 'function') {
      args[args.length - 1] = (error: Error | null, ...results: unknown[]) => {
        discardTimedOutClient(client, error);
        callback(error, ...results);
      };
    }
    const result: unknown = Reflect.apply(query, client, args);
    return result instanceof Promise ? result.catch(error => {
      discardTimedOutClient(client, error);
      throw error;
    }) : result;
  } as typeof client.query;
}

// Better Authは"rateLimit"."lastRequest"をint8で保存し、lastRequest + window * 1000 を計算して
// X-Retry-Afterを返す。pgの既定ではint8が文字列になり、文字列連結で約1.8e14秒の待ち時間になる（#84 F-10）。
// 安全な整数範囲 [-(2^53-1), 2^53-1] の外は変換せずに失敗させる（黙って丸めない）。
function int8AsSafeNumber(value: string): number {
  if (!/^-?\d+$/.test(value)) throw new RangeError('int8の10進整数ではありません。');
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new RangeError('int8の値が安全な整数範囲を超えています。');
  return n;
}

// 認証専用の接続pool。このpoolで受け取るTEXT形式のint8（OID 20）だけを数値へ変換する。
// pg.typesをグローバルに書き換えないため、アプリ用poolや他の型には影響しない。
export function createAuthPool(o: AppPoolOptions): pg.Pool {
  const getTypeParser = ((oid: number, format?: 'text' | 'binary') =>
    oid === INT8_OID && format !== 'binary'
      ? int8AsSafeNumber
      : pg.types.getTypeParser(oid, format as 'text')) as typeof pg.types.getTypeParser;
  const pool = new pg.Pool({
    ...runtimePoolOptions(o),
    max: o.max ?? 2,
    types: { getTypeParser },
  });
  pool.on('connect', (client) => protectRuntimeClient(client, 'auth'));
  // app側listenerに依存せずidle切断で落とさない。認証情報を含む可能性のあるerror全文は出さない。
  pool.on('error', () => console.warn('auth: idle DB connection lost; affected client discarded'));
  return pool;
}
