// 使い方: node src/db/schema-check-cli.ts [migrationsDir]（npm run db:check）。
// DATABASE_URLだけを使い、DBを変更せずに migration履歴・認証schema の差分をJSON 1行で出す。
// 終了コード: 0 差分なし / 1 差分あり / 2 使い方・設定の誤り / 3 接続失敗・timeout等で判定不能。
// 接続文字列・例外原文・stackは出力しない。DB検査と接続/queryの上限をそれぞれ明示できる。
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../config.ts';
import { DEFAULT_QUERY_TIMEOUT_MS, DEFAULT_TOTAL_TIMEOUT_MS, exitCodeFor, runSchemaCheck, SchemaCheckConfigurationError, type SchemaCheckOptions } from './schema-check.ts';

const USAGE = '使い方: node src/db/schema-check-cli.ts [migrationsDir]';

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

const args = process.argv.slice(2);
if (args.length > 1 || args[0]?.startsWith('-')) fail(USAGE);

function timeout(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1_000 || n > 600_000) fail(`環境変数 ${name} は 1000〜600000 の整数で指定してください。`);
  return n;
}
const totalTimeoutMs = timeout('SCHEMA_CHECK_TIMEOUT_MS', DEFAULT_TOTAL_TIMEOUT_MS);
const queryTimeoutMs = timeout('SCHEMA_CHECK_QUERY_TIMEOUT_MS', DEFAULT_QUERY_TIMEOUT_MS);

let options: SchemaCheckOptions;
try {
  // loadConfigのメッセージは値（DATABASE_URL等）を含まない。
  options = { connectionString: loadConfig().databaseUrl, queryTimeoutMs, totalTimeoutMs };
} catch (error) {
  fail(error instanceof Error ? error.message : '設定の読み込みに失敗しました。');
}
if (args[0] !== undefined) options.migrationsDir = pathToFileURL(args[0].endsWith('/') ? args[0] : `${args[0]}/`);

try {
  const report = await runSchemaCheck(options);
  // pipeへの書込み完了を待つが、止まった出力先にもquery予算を上限にする。
  // DB/pool終了後に残ったhandleは最終process終了で閉じる。
  const outputTimer = setTimeout(() => process.exit(3), queryTimeoutMs);
  process.stdout.on('error', () => process.exit(3));
  process.stdout.write(`${JSON.stringify(report)}\n`, (error) => {
    clearTimeout(outputTimer);
    process.exit(error ? 3 : exitCodeFor(report));
  });
} catch (error) {
  if (error instanceof SchemaCheckConfigurationError) fail(error.message);
  // ファイル列挙など接続前の失敗。原文は出さない。
  console.error('schema-check: 検査を実行できませんでした。migrationsDirとDATABASE_URLを確認してください。');
  process.exit(3);
}
