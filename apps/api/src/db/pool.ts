import pg from 'pg';

const INT8_OID = 20;

// アプリ用の接続pool。int8はpgの既定（文字列）のまま。認証用poolの変換（下記）はこちらへ波及しない。
export function createAppPool(o: { connectionString: string; max?: number }): pg.Pool {
  return new pg.Pool({
    connectionString: o.connectionString,
    max: o.max ?? 5,
    // 到達不能なDBでhealthが無期限に待たないよう、接続確立に上限を置く。
    connectionTimeoutMillis: 5_000,
  });
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
export function createAuthPool(o: { connectionString: string; max?: number }): pg.Pool {
  const getTypeParser = ((oid: number, format?: 'text' | 'binary') =>
    oid === INT8_OID && format !== 'binary'
      ? int8AsSafeNumber
      : pg.types.getTypeParser(oid, format as 'text')) as typeof pg.types.getTypeParser;
  return new pg.Pool({
    connectionString: o.connectionString,
    max: o.max ?? 2,
    connectionTimeoutMillis: 5_000,
    types: { getTypeParser },
  });
}
