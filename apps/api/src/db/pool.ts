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
export function createAppPool(o: AppPoolOptions): pg.Pool {
  return new pg.Pool({
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
  });
}
