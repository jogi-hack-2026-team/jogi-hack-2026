import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { collectTestFiles } from '../scripts/test-files.mjs';

test('test discovery: check command actually executes nested tests and excludes examples', () => {
  const directory = mkdtempSync(join(tmpdir(), 'prediction-test-discovery-'));
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
  try {
    mkdirSync(join(directory, 'scripts'));
    mkdirSync(join(directory, 'tests', 'nested', 'deeper'), { recursive: true });
    for (const name of ['check.mjs', 'test-files.mjs']) {
      copyFileSync(new URL('../scripts/' + name, import.meta.url), join(directory, 'scripts', name));
    }
    writeFileSync(join(directory, 'compiler.cjs'), '// This fixture tests discovery after compilation only.');
    const nested = join(directory, 'tests', 'nested', 'deeper', 'regression.test.mjs');
    const marker = join(directory, 'nested-executed');
    writeFileSync(nested, "import test from 'node:test'; import { writeFileSync } from 'node:fs'; " +
      "test('nested-regression-was-executed', () => writeFileSync(" + JSON.stringify(marker) + ", 'executed'));");
    writeFileSync(join(directory, 'tests', 'example.mjs'), "throw new Error('example must not be executed');");
    assert.deepEqual(collectTestFiles(join(directory, 'tests')), [nested]);
    // 親test runnerのIPC contextをfixtureへ持ち込まない。stdout形式ではなく実行の副作用で確認する。
    const fixtureEnv = { ...process.env };
    delete fixtureEnv.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, [join(directory, 'scripts', 'check.mjs'), 'test', '--tsc',
      join(directory, 'compiler.cjs')], { env: fixtureEnv, encoding: 'utf8', windowsHide: true, timeout: 30_000 });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(readFileSync(marker, 'utf8'), 'executed');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
