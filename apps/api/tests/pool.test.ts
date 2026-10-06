import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { buildApp } from '../src/app.ts';
import { createAppPool } from '../src/db/pool.ts';
import { createTestDatabase } from './helpers/database.ts';

async function waitUntil(condition: () => boolean, label: string, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

test('idle接続がDB側から切られてもプロセスは落ちず、poolは接続を破棄して次のhealthで復帰する', async (t) => {
  const db = await createTestDatabase();
  const app = await buildApp({ pool: db.pool, logger: false });
  const admin = new pg.Client({ connectionString: db.connectionString });
  await admin.connect();
  t.after(async () => {
    await app.close();
    await admin.end();
    await db.close();
  });

  // 1本の接続を使ってidleへ戻し、そのbackendをサーバー側から終了させる（network切断と同じ経路でpoolへ届く）。
  const { rows } = await db.pool.query<{ pid: number }>('select pg_backend_pid() as pid');
  assert.equal(db.pool.idleCount, 1);
  await admin.query('select pg_terminate_backend($1)', [rows[0]?.pid]);

  // listenerがなければここで未処理の'error'となりテストプロセスごと失敗する。poolが切断したclientを除去するまで待つ。
  await waitUntil(() => db.pool.totalCount === 0, 'pool discards the terminated client');

  const res = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { status: 'ok', database: 'ok' });
});

test('接続後に応答が止まったクエリはclient側の期限で失敗し、そのclientは再利用されない', async (t) => {
  const db = await createTestDatabase();
  const pool = createAppPool({ connectionString: db.connectionString, queryTimeoutMs: 300 });
  t.after(async () => {
    await pool.end();
    await db.close();
  });

  const started = Date.now();
  await assert.rejects(pool.query('select pg_sleep(2)'), /Query read timeout/);
  assert.ok(Date.now() - started < 1_500, 'query gives up near the configured deadline');
  // 期限切れのclientはpoolから除かれ（応答待ちのままの接続を次の要求へ渡さない）、次のクエリは新しい接続で成功する。
  await waitUntil(() => pool.totalCount === 0, 'pool discards the timed-out client');
  const { rows } = await pool.query<{ one: number }>('select 1 as one');
  assert.equal(rows[0]?.one, 1);
});

test('server側のstatement_timeoutでも文が打ち切られ、poolは失敗したclientを破棄する', async (t) => {
  const db = await createTestDatabase();
  const pool = createAppPool({ connectionString: db.connectionString, statementTimeoutMs: 300 });
  t.after(async () => {
    await pool.end();
    await db.close();
  });

  await assert.rejects(pool.query('select pg_sleep(2)'), (error: unknown) => {
    assert.equal((error as { code?: string }).code, '57014'); // query_canceled
    return true;
  });
  await waitUntil(() => pool.totalCount === 0, 'pool discards the cancelled client');
  const { rows } = await pool.query<{ one: number }>('select 1 as one');
  assert.equal(rows[0]?.one, 1);
});
