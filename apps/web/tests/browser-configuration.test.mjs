import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 未設定でfixture DB接続やブラウザ起動へ進まないことを、実runnerの入口で確認する。
for (const missing of [
  ['ISSUE148_PLAYWRIGHT_ROOT', 'ISSUE148_BROWSER_EXE'],
  ['ISSUE148_PLAYWRIGHT_ROOT'],
  ['ISSUE148_BROWSER_EXE'],
]) {
  test(`browser runner: ${missing.join(' / ')}未設定を理由付きで拒否する`, () => {
    const env = { ...process.env, ISSUE148_PLAYWRIGHT_ROOT: '/unavailable/playwright', ISSUE148_BROWSER_EXE: '/unavailable/browser', ISSUE148_DB_PORT: '1' };
    for (const name of missing) delete env[name];
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./issue148-browser.mjs', import.meta.url))], { env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /必要な環境変数が未設定:/);
    for (const name of missing) assert.ok(result.stderr.includes(name));
    assert.match(result.stderr, /docs\/operations\/issue148-verification\.md/);
    assert.doesNotMatch(result.stderr, /ECONNREFUSED|MODULE_NOT_FOUND|Executable doesn't exist/);
  });
}
