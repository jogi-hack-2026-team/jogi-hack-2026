import pg from 'pg';

// アプリ用の接続pool。int8はpgの既定（文字列）のまま。認証用poolの変換は#74で別に扱う。
export function createAppPool(o: { connectionString: string; max?: number }): pg.Pool {
  return new pg.Pool({
    connectionString: o.connectionString,
    max: o.max ?? 5,
    // 到達不能なDBでhealthが無期限に待たないよう、接続確立に上限を置く。
    connectionTimeoutMillis: 5_000,
  });
}
