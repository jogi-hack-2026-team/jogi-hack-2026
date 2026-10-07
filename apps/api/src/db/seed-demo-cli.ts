// 認証→アプリmigrationの成功後にoperatorが明示実行する。アカウント作成と資格情報の保存は行わない。
import { parseDemoSeedArgs } from './demo-seed-args.ts';
import { createDemoSeedPool } from './pool.ts';
import { DemoSeedError, seedDemo } from './seed-demo.ts';

const options = parseDemoSeedArgs(process.argv.slice(2));
const databaseUrl = process.env.DATABASE_URL;
if (!options || !databaseUrl) {
  console.error('db:seed:demo は DATABASE_URL と --user-id <認証で作成済みのdemoユーザーID> --timezone <IANA名> が必要です。');
  process.exitCode = 2;
} else {
  const pool = createDemoSeedPool({ connectionString: databaseUrl });
  try {
    const { goals: _goals, ...result } = await seedDemo(pool, options);
    console.log(JSON.stringify(result));
  } catch (error) {
    // 接続URL・userId・SQL・例外原文は出力しない。commit応答不明をrollback成功と取り違えない。
    console.error(JSON.stringify({ error: error instanceof DemoSeedError ? error.code : 'FAILED' }));
    process.exitCode = 1;
  } finally {
    try { await pool.end(); } catch { console.error(JSON.stringify({ error: 'POOL_CLOSE_FAILED' })); process.exitCode = 1; }
  }
}
