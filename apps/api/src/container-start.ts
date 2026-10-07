// コンテナ専用の起動点。ComposeのinitがSIGTERMをこのNode processへ転送する。
// migration中は既定のsignal終了、配信後はserver.tsの正常終了処理を使う。
import { loadAuthConfig, loadConfig } from './config.ts';
import { migrate } from './db/migrate.ts';
import { createMigrationPool } from './db/pool.ts';

let phase = 'configuration';
async function start(): Promise<void> {
  const config = loadConfig();
  // production認証設定の不足を、DBを書き換える前に検出する。
  loadAuthConfig(process.env, config);
  phase = 'migration';
  const pool = createMigrationPool({ connectionString: config.databaseUrl });
  try {
    await migrate(pool, 'all');
    console.log('startup: migrations complete');
  } finally {
    await pool.end();
  }
  // server.tsがlistenerを開くのは全migrationの成功後。同一processでSIGTERMを処理する。
  phase = 'server';
  await import('./server.ts');
}

try {
  await start();
} catch {
  // DB・ライブラリの例外には接続文字列等が含まれ得るため、原文をログへ出さない。
  console.error(`startup: ${phase} failed; check configuration, DB availability and migration history. API was not started.`);
  process.exit(1);
}
