// 使い方: node src/db/schema-check-cli.ts [migrationsDir]（npm run db:check）。
// DATABASE_URLだけを使い、DBを変更せずに migration履歴・認証schema の差分をJSON 1行で出す。
// 終了コード: 0 差分なし / 1 差分あり / 2 使い方・設定の誤り / 3 接続失敗・timeout等で判定不能。
// 接続文字列・例外原文・stackは出力しない。任意の SCHEMA_CHECK_TIMEOUT_MS（1000〜600000）で全体の上限を変えられる。
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../config.ts';
import { DEFAULT_TOTAL_TIMEOUT_MS, exitCodeFor, runSchemaCheck, type SchemaCheckOptions } from './schema-check.ts';

const USAGE = '使い方: node src/db/schema-check-cli.ts [migrationsDir]';

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

const args = process.argv.slice(2);
if (args.length > 1 || args[0]?.startsWith('-')) fail(USAGE);

let totalTimeoutMs = DEFAULT_TOTAL_TIMEOUT_MS;
const rawTimeout = process.env.SCHEMA_CHECK_TIMEOUT_MS;
if (rawTimeout !== undefined && rawTimeout !== '') {
  const n = Number(rawTimeout);
  if (!Number.isInteger(n) || n < 1_000 || n > 600_000) fail('環境変数 SCHEMA_CHECK_TIMEOUT_MS は 1000〜600000 の整数で指定してください。');
  totalTimeoutMs = n;
}

let options: SchemaCheckOptions;
try {
  // loadConfigのメッセージは値（DATABASE_URL等）を含まない。
  options = { connectionString: loadConfig().databaseUrl, totalTimeoutMs };
} catch (error) {
  fail(error instanceof Error ? error.message : '設定の読み込みに失敗しました。');
}
if (args[0] !== undefined) options.migrationsDir = pathToFileURL(args[0].endsWith('/') ? args[0] : `${args[0]}/`);

try {
  const report = await runSchemaCheck(options);
  console.log(JSON.stringify(report));
  // pool終了が止まった場合も残った接続ごとprocessを終える。
  process.exit(exitCodeFor(report));
} catch {
  // ファイル列挙など接続前の失敗。原文は出さない。
  console.error('schema-check: 検査を実行できませんでした。migrationsDirとDATABASE_URLを確認してください。');
  process.exit(3);
}
