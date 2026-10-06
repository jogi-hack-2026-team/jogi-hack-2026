// 使い方: node src/db/migrate-cli.ts auth|app|all（npm run db:migrate[:auth|:app]）。
// DATABASE_URLだけを使う。結果はJSONで1行出力し、接続文字列は出力しない。
import { loadConfig } from '../config.ts';
import { migrate, type MigrationTarget } from './migrate.ts';
import { createMigrationPool } from './pool.ts';

const target = process.argv[2];
if (target !== 'auth' && target !== 'app' && target !== 'all' || process.argv.length > 3) {
  console.error('使い方: node src/db/migrate-cli.ts auth|app|all');
  process.exit(2);
}

const config = loadConfig();
const pool = createMigrationPool({ connectionString: config.databaseUrl });
try {
  const result = await migrate(pool, target as MigrationTarget);
  console.log(JSON.stringify(result));
} finally {
  await pool.end();
}
