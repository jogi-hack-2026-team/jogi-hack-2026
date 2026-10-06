import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import pg from 'pg';
import { buildApp } from '../src/app.ts';

// SPA配信の規則だけを確かめる。DBには接続しない。
async function appWithSpa(t: test.TestContext) {
  const webDist = mkdtempSync(join(tmpdir(), 'futureroi-web-'));
  mkdirSync(join(webDist, 'assets'));
  writeFileSync(join(webDist, 'index.html'), '<!doctype html><title>spa</title>');
  writeFileSync(join(webDist, 'assets', 'app-abc123.js'), 'console.log(1)');
  const pool = new pg.Pool({ connectionString: 'postgres://nobody:nothing@127.0.0.1:1/none' });
  const app = await buildApp({ pool, webDist, logger: false });
  t.after(async () => {
    await app.close();
    await pool.end();
    rmSync(webDist, { recursive: true, force: true });
  });
  return app;
}

test('GET / と深いURLへの直接アクセスはindex.htmlを返し、再検証を求める', async (t) => {
  const app = await appWithSpa(t);
  for (const url of ['/', '/goals/9f1c', '/login?next=%2Fgoals']) {
    const res = await app.inject({ method: 'GET', url });
    assert.equal(res.statusCode, 200, url);
    assert.match(res.headers['content-type']?.toString() ?? '', /^text\/html/, url);
    assert.equal(res.headers['cache-control'], 'no-cache', url);
    assert.match(res.body, /<title>spa<\/title>/, url);
  }
});

test('hash付きassetsは長期キャッシュできる', async (t) => {
  const app = await appWithSpa(t);
  const res = await app.inject({ method: 'GET', url: '/assets/app-abc123.js' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['cache-control'], 'public, max-age=31536000, immutable');
});

test('存在しないAPI、対象外のmethod、拡張子付きの未知ファイルにはHTMLを返さない', async (t) => {
  const app = await appWithSpa(t);
  const cases = [
    { method: 'GET', url: '/api/nope' },
    { method: 'POST', url: '/api/nope' },
    { method: 'POST', url: '/goals' },
    { method: 'DELETE', url: '/' },
    { method: 'GET', url: '/assets/old-build.js' },
  ] as const;
  for (const c of cases) {
    const res = await app.inject(c);
    assert.equal(res.statusCode, 404, `${c.method} ${c.url}`);
    assert.deepEqual(res.json(), { error: { code: 'NOT_FOUND', message: 'No such route.' } }, `${c.method} ${c.url}`);
  }
});
