import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultDirectory = new URL('../apps/api/migrations/', import.meta.url);

export function migrationInventory(directory = defaultDirectory) {
  // runnerの出力を期待値に使わず、同じ抽出規則・名前順でSQLの実在を確認する。
  const names = readdirSync(directory).filter(name => /^\d{4}_[\w-]+\.sql$/.test(name)).sort();
  assert.ok(names.length > 0, 'Migration directory must contain at least one numbered SQL file');
  const base = directory instanceof URL ? fileURLToPath(directory) : directory;
  for (const name of names) assert.ok(statSync(resolve(base, name)).isFile(), `${name} must be a file`);
  return names;
}

export function verifyMigrationResult(result, mode, directory = defaultDirectory) {
  assert.ok(mode === 'first' || mode === 'noop', 'Mode must be first or noop');
  const expected = migrationInventory(directory);
  assert.equal(result?.target, 'all', 'Expected an all-target migration result');
  assert.ok(Array.isArray(result.auth?.tablesCreated) && Array.isArray(result.auth?.columnsAdded), 'Missing auth result');
  if (mode === 'first') {
    assert.deepEqual(result.app?.applied, expected, 'Applied migrations must match the filesystem inventory in order');
  } else {
    assert.deepEqual(result, { target: 'all', auth: { tablesCreated: [], columnsAdded: [] }, app: { applied: [] } }, 'Repeated migration must be a no-op');
  }
}

// CI: migrationのJSONをstdinで受ける。任意のdirectoryは合成fixture検証にも使う。
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.ok(process.argv.length === 3 || process.argv.length === 4, 'Usage: check-migrations.mjs first|noop [directory]');
    verifyMigrationResult(JSON.parse(readFileSync(0, 'utf8')), process.argv[2], process.argv[3] ?? defaultDirectory);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
