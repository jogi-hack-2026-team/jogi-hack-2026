import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { createAppPool, createAuthPool, createMigrationPool } from '../src/db/pool.ts';
import { migrate } from '../src/db/migrate.ts';
import { createTestDatabase } from './helpers/database.ts';

async function waitFor(check: () => Promise<boolean>) {
  const deadline = Date.now() + 5_000;
  while (!await check()) {
    assert.ok(Date.now() < deadline, 'operation reaches expected DB wait');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

test('認証pool単独でもidle切断後に新しい接続で復旧する', async (t) => {
  const db = await createTestDatabase();
  const auth = createAuthPool({ connectionString: db.connectionString, max: 1 });
  t.after(async () => { await auth.end(); await db.close(); });
  const pid = (await auth.query<{ pid: number }>('select pg_backend_pid() as pid')).rows[0]!.pid;
  await db.pool.query('select pg_terminate_backend($1)', [pid]);
  await waitFor(async () => auth.totalCount === 0);
  assert.equal((await auth.query('select 1 as one')).rows[0].one, 1);
});

test('認証poolにもclient期限と失敗clientの破棄が適用される', async (t) => {
  const db = await createTestDatabase();
  const auth = createAuthPool({ connectionString: db.connectionString, queryTimeoutMs: 100 });
  t.after(async () => { await auth.end(); await db.close(); });
  const client = await auth.connect();
  const pid = (await client.query('select pg_backend_pid() as pid')).rows[0].pid;
  try {
    await assert.rejects(client.query('select pg_sleep(1)'), /Query read timeout/);
  } finally {
    client.release(); // Kyselyと同じerror引数なしの解放
  }
  await waitFor(async () => auth.totalCount === 0);
  const next = (await auth.query('select 1 as one, pg_backend_pid() as pid')).rows[0];
  assert.equal(next.one, 1);
  assert.notEqual(next.pid, pid);
});

test('アプリpoolの取得済みclientも期限で破棄され、rollback失敗後のerrorなしreleaseでも再利用しない', async (t) => {
  const db = await createTestDatabase();
  const app = createAppPool({ connectionString: db.connectionString, queryTimeoutMs: 100 });
  t.after(async () => { await app.end(); await db.close(); });
  const client = await app.connect();
  const pid = (await client.query('select pg_backend_pid() as pid')).rows[0].pid;
  try {
    await client.query('begin');
    await assert.rejects(client.query('select pg_sleep(1)'), /Query read timeout/);
    await assert.rejects(client.query('rollback'), /closed|terminated|queryable|ending/);
  } finally {
    client.release();
  }
  await waitFor(async () => app.totalCount === 0);
  const next = (await app.query('select 1 as one, pg_backend_pid() as pid')).rows[0];
  assert.equal(next.one, 1);
  assert.notEqual(next.pid, pid);
});

test('アプリpoolの取得済み接続切断を処理し、次の通常操作は新しい接続で復旧する', async (t) => {
  const db = await createTestDatabase();
  const app = createAppPool({ connectionString: db.connectionString });
  t.after(async () => { await app.end(); await db.close(); });
  const client = await app.connect();
  let ended = false;
  client.once('end', () => { ended = true; });
  try {
    const pid = (await client.query('select pg_backend_pid() as pid')).rows[0].pid;
    await db.pool.query('select pg_terminate_backend($1)', [pid]);
    await waitFor(async () => ended);
    await assert.rejects(client.query('select 1'));
  } finally {
    client.release();
  }
  await waitFor(async () => app.totalCount === 0);
  assert.equal((await app.query('select 1 as one')).rows[0].one, 1);
});

test('migration専用poolはadvisory lockを5秒超待ってから成功する', async (t) => {
  const db = await createTestDatabase();
  const migrationUrl = new URL(db.connectionString);
  migrationUrl.searchParams.set('options', '-c statement_timeout=1000 -c application_name=migration_options_test');
  const pool = createMigrationPool({ connectionString: migrationUrl.toString() });
  const databaseName = new URL(db.connectionString).pathname.slice(1);
  assert.match(databaseName, /^t_[a-f0-9]+$/);
  await db.pool.query(`alter database "${databaseName}" set statement_timeout = '1s'`);
  const ordinary = new pg.Client({ connectionString: db.connectionString });
  await ordinary.connect();
  try {
    assert.equal((await ordinary.query('show statement_timeout')).rows[0].statement_timeout, '1s');
  } finally {
    await ordinary.end();
  }
  const blocker = await db.pool.connect();
  t.after(async () => { blocker.release(); await pool.end(); await db.close(); });
  await blocker.query('select pg_advisory_lock($1)', [70_740_001]);
  const waiting = migrate(pool, 'auth').then(value => ({ value, error: undefined }), error => ({ value: undefined, error }));
  try {
    await waitFor(async () => (await blocker.query('select 1 from pg_locks where locktype = \'advisory\' and objid = $1 and not granted', [70_740_001])).rowCount !== 0);
    await new Promise(resolve => setTimeout(resolve, 5_100));
  } finally {
    await blocker.query('select pg_advisory_unlock($1)', [70_740_001]);
  }
  const result = await waiting;
  assert.equal(result.error, undefined);
  assert.ok(result.value?.auth?.tablesCreated.includes('user'));
  assert.equal((await pool.query('show statement_timeout')).rows[0].statement_timeout, '0');
  assert.equal((await pool.query('show application_name')).rows[0].application_name, 'migration_options_test');
});
