import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { buildApp } from '../src/app.ts';
import { createTestDatabase } from './helpers/database.ts';

test('GET /api/health: DBへ到達できれば200で status ok / database ok を返す', async (t) => {
  const db = await createTestDatabase();
  const app = await buildApp({ pool: db.pool, logger: false });
  t.after(async () => {
    await app.close();
    await db.close();
  });
  const res = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { status: 'ok', database: 'ok' });
});

test('GET /api/health: DBへ到達できなければ503で database unreachable を返す', async (t) => {
  // 誰も待ち受けていないportへ接続させる。接続上限を短くして待ち時間を抑える。
  const pool = new pg.Pool({ connectionString: 'postgres://nobody:nothing@127.0.0.1:1/none', connectionTimeoutMillis: 500 });
  const app = await buildApp({ pool, logger: false });
  t.after(async () => {
    await app.close();
    await pool.end();
  });
  const res = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.json(), { status: 'error', database: 'unreachable' });
});

test('存在しないAPI routeはJSONの404', async (t) => {
  const pool = new pg.Pool({ connectionString: 'postgres://nobody:nothing@127.0.0.1:1/none' });
  const app = await buildApp({ pool, logger: false });
  t.after(async () => {
    await app.close();
    await pool.end();
  });
  const res = await app.inject({ method: 'GET', url: '/api/nope' });
  assert.equal(res.statusCode, 404);
  assert.equal(res.headers['content-type']?.toString().startsWith('application/json'), true);
  assert.deepEqual(res.json(), { error: { code: 'NOT_FOUND', message: 'No such route.' } });
});
