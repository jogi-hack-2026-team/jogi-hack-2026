export type ApiConfig = {
  host: string;
  port: number;
  databaseUrl: string;
  webDist: string | undefined;
  logLevel: string;
  shutdownTimeoutMs: number;
};

function integer(name: string, raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`環境変数 ${name} は ${min}〜${max} の整数で指定してください。`);
  }
  return n;
}

// 環境変数からAPIの設定を組み立てる。値（特にDATABASE_URL）はエラーやログに出さない。
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('環境変数 DATABASE_URL が未設定です。.env.example を参照して接続先を設定してください。');
  }
  return {
    host: env.HOST || '127.0.0.1',
    port: integer('PORT', env.PORT, 3000, 1, 65_535),
    databaseUrl,
    webDist: env.WEB_DIST || undefined,
    logLevel: env.LOG_LEVEL || 'info',
    shutdownTimeoutMs: integer('SHUTDOWN_TIMEOUT_MS', env.SHUTDOWN_TIMEOUT_MS, 10_000, 1_000, 120_000),
  };
}
