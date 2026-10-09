import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { migrationInventory, verifyMigrationResult } from '../check-migrations.mjs';

const checker = fileURLToPath(new URL('../check-migrations.mjs', import.meta.url));
const first = applied => ({ target: 'all', auth: { tablesCreated: ['user'], columnsAdded: [] }, app: { applied } });
const noop = { target: 'all', auth: { tablesCreated: [], columnsAdded: [] }, app: { applied: [] } };
function fixture(t, names = []) {
  const directory = mkdtempSync(join(tmpdir(), 'futureroi-inventory-'));
  t.after(() => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('futureroi-inventory-'));
    rmSync(directory, { recursive: true, force: true });
  });
  for (const name of names) writeFileSync(join(directory, name), '-- fixture');
  return directory;
}

test('番号が同じ異なるSQLも全文名で並べ、runnerが選ばない拡張子・名前は除く', t => {
  const directory = fixture(t, ['0005_goal_target_date.sql', '0005_goal_data_integrity.sql', '0001_first.sql',
    'notes.sql', '0006_upper.SQL', '0007_backup.sql.bak', '0008_bad name.sql', 'README.md']);
  const names = ['0001_first.sql', '0005_goal_data_integrity.sql', '0005_goal_target_date.sql'];
  assert.deepEqual(migrationInventory(directory), names);
  verifyMigrationResult(first(names), 'first', directory);
  writeFileSync(join(directory, '0006_added.sql'), '-- added without changing the checker');
  verifyMigrationResult(first([...names, '0006_added.sql']), 'first', directory);
  assert.throws(() => verifyMigrationResult(first(names), 'first', directory), /filesystem inventory/);
});

test('未適用・余分・逆順・重複・directory付きの名前は失敗する', t => {
  const names = ['0001_first.sql', '0002_second.sql'];
  const directory = fixture(t, names);
  for (const applied of [[names[0]], [...names, '0003_extra.sql'], [...names].reverse(), [names[0], ...names],
    names.map(name => `apps/api/migrations/${name}`)]) {
    assert.throws(() => verifyMigrationResult(first(applied), 'first', directory), /filesystem inventory/);
  }
});

test('0件・存在しないpath・SQL名のdirectoryを成功扱いしない', t => {
  const directory = fixture(t, ['notes.txt']);
  assert.throws(() => verifyMigrationResult(first([]), 'first', directory), /at least one/);
  assert.throws(() => verifyMigrationResult(noop, 'noop', directory), /at least one/);
  assert.throws(() => migrationInventory(join(directory, 'absent')), /ENOENT/);
  mkdirSync(join(directory, '0001_directory.sql'));
  assert.throws(() => migrationInventory(directory), /must be a file/);
});

test('反復はappだけでなくauthにも差分がないことを確認する', t => {
  const directory = fixture(t, ['0001_first.sql']);
  verifyMigrationResult(noop, 'noop', directory);
  for (const changed of [first(['0001_first.sql']), { ...noop, auth: { tablesCreated: [], columnsAdded: ['user'] } },
    { ...noop, auth: { tablesCreated: ['user'], columnsAdded: [] } }, { ...noop, target: 'app' }]) {
    assert.throws(() => verifyMigrationResult(changed, 'noop', directory));
  }
  assert.throws(() => verifyMigrationResult(first(['0001_first.sql']), 'typo', directory), /Mode/);
  assert.throws(() => verifyMigrationResult({ target: 'all', app: { applied: ['0001_first.sql'] } }, 'first', directory), /auth/);
});

test('CLIは別cwd・空白を含むpathでも検査し、JSON不正・未適用・未知modeはexit 1', t => {
  const root = fixture(t);
  const directory = join(root, 'SQL fixtures');
  mkdirSync(directory);
  writeFileSync(join(directory, '0001_first.sql'), '-- fixture');
  const cli = (input, mode = 'first', dir = directory) => spawnSync(process.execPath, [checker, mode, dir],
    { input, encoding: 'utf8', cwd: root });
  assert.equal(cli(JSON.stringify(first(['0001_first.sql']))).status, 0);
  assert.equal(cli(JSON.stringify(noop), 'noop').status, 0);
  assert.equal(cli(JSON.stringify(first([]))).status, 1);
  assert.equal(cli('{invalid').status, 1);
  assert.equal(cli(JSON.stringify(noop), 'typo').status, 1);
  const defaultPath = spawnSync(process.execPath, [checker, 'first'],
    { input: JSON.stringify(first(migrationInventory())), encoding: 'utf8', cwd: root });
  assert.equal(defaultPath.status, 0, defaultPath.stderr);
});
