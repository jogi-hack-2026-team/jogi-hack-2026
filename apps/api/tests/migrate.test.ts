import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import pg from 'pg';
import { migrate, migrateApp, MigrationChecksumError } from '../src/db/migrate.ts';
import { createAuthPool } from '../src/db/pool.ts';
import { getMigrations } from 'better-auth/db/migration';
import { authSchemaOptions } from '../src/auth/options.ts';
import { createTestDatabase } from './helpers/database.ts';

const publicTables = async (pool: pg.Pool) =>
  (await pool.query<{ table_name: string }>(`select table_name from information_schema.tables where table_schema = 'public' order by 1`)).rows.map((r) => r.table_name);

const sqlState = async (pool: pg.Pool, sql: string, params: unknown[] = []) => {
  try {
    await pool.query(sql, params);
    return 'accepted';
  } catch (error) {
    return (error as { code?: string }).code ?? 'unknown';
  }
};

async function insertUser(pool: pg.Pool, id: string) {
  await pool.query(
    `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values ($1, $1, $2, false, now(), now())`,
    [id, `${id}@example.test`],
  );
}

const goalInsert = `insert into goal (user_id, title, unit, total_required, initial_progress, session_amount, timezone, record_start_date)
                    values ($1, $2, $3, $4, $5, $6, 'Asia/Tokyo', '2026-10-01') returning id`;
// runnerの結果から期待値を作らず、実在するSQLを同じ抽出規則・名前順で独立に列挙する。
const APP_MIGRATIONS = readdirSync(new URL('../migrations/', import.meta.url)).filter(name => /^\d{4}_[\w-]+\.sql$/.test(name)).sort();

test('CI checkerは追加SQL・同番号の異名・反復no-opを検証し、実在する未適用SQLを拒否する', async t => {
  const db = await createTestDatabase();
  t.after(() => db.close());
  const dir = mkdtempSync(join(tmpdir(), 'futureroi-ci-inventory-'));
  t.after(() => {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    assert.ok(basename(dir).startsWith('futureroi-ci-inventory-'));
    rmSync(dir, { recursive: true, force: true });
  });
  for (const name of APP_MIGRATIONS) writeFileSync(join(dir, name), readFileSync(new URL(`../migrations/${name}`, import.meta.url)));
  // #163/#175の全文名を使う合成fixture。製品SQLや適用済み履歴は変更しない。
  const extras = ['0005_goal_target_date.sql', '0005_goal_data_integrity.sql'].filter(name => !APP_MIGRATIONS.includes(name));
  extras.forEach((name, index) => writeFileSync(join(dir, name), `create table ci_inventory_${index} (id integer);`));
  const expected = [...APP_MIGRATIONS, ...extras].sort();
  const workflow = readFileSync(new URL('../../../.github/workflows/application.yml', import.meta.url), 'utf8');
  const checker = fileURLToPath(new URL('../../../scripts/check-migrations.mjs', import.meta.url));
  const check = (result: unknown, mode: string) => spawnSync(process.execPath, [checker, mode, dir], { input: JSON.stringify(result), encoding: 'utf8' });
  const first = await migrate(db.pool, 'all', pathToFileURL(`${dir}/`));
  assert.deepEqual(first.app?.applied, expected);
  const verified = check(first, 'first');
  assert.equal(verified.status, 0, verified.stderr);
  for (let index = 0; index < extras.length; index++) {
    assert.equal((await db.pool.query(`select to_regclass('ci_inventory_${index}')::text as name`)).rows[0]?.name, `ci_inventory_${index}`);
  }
  const second = await migrate(db.pool, 'all', pathToFileURL(`${dir}/`));
  const repeated = check(second, 'noop');
  assert.equal(repeated.status, 0, repeated.stderr);
  const pending = '9999_ci_unapplied.sql';
  writeFileSync(join(dir, pending), 'create table ci_unapplied (id integer);');
  const rejected = check(first, 'first');
  assert.equal(rejected.status, 1, 'the same CI checker rejects a file the runner has not applied');
  assert.match(rejected.stderr, /9999_ci_unapplied\.sql/);
  assert.equal((await db.pool.query("select to_regclass('ci_unapplied') as name")).rows[0]?.name, null);
  assert.equal((await db.pool.query('select count(*)::int as n from schema_migrations where name = $1', [pending])).rows[0]?.n, 0);
  assert.equal(readFileSync(new URL('../../../.github/workflows/application.yml', import.meta.url), 'utf8'), workflow, 'fixture additions do not edit the workflow');
});

test('R11 migration 0003 keeps existing Goals and logs, starts unanswered at revision 0, and is idempotent', async t => {
  const db = await createTestDatabase();
  t.after(() => db.close());
  const dir = mkdtempSync(join(tmpdir(), 'futureroi-r11-migration-'));
  const url = pathToFileURL(`${dir}/`);
  for (const name of APP_MIGRATIONS.slice(0, 2)) writeFileSync(join(dir, name), readFileSync(new URL(`../migrations/${name}`, import.meta.url)));
  await migrate(db.pool, 'all', url);
  await insertUser(db.pool, 'r11-existing-owner');
  const id = (await db.pool.query<{ id: string }>(goalInsert, ['r11-existing-owner', 'preserve', 'minutes', 100, 7, 30])).rows[0]!.id;
  await db.pool.query(`insert into action_log (goal_id, local_date, status, amount) values ($1, '2026-10-05', 'DONE', 13)`, [id]);
  const before = (await db.pool.query('select * from goal where id = $1', [id])).rows[0];
  const logs = (await db.pool.query('select * from action_log where goal_id = $1', [id])).rows;
  const name = APP_MIGRATIONS[2]!;
  writeFileSync(join(dir, name), readFileSync(new URL(`../migrations/${name}`, import.meta.url)));
  assert.deepEqual(await migrate(db.pool, 'app', url), { target: 'app', app: { applied: [name] } });
  const { question_prior, answer_revision, question_prior_snapshot, ...after } = (await db.pool.query('select * from goal where id = $1', [id])).rows[0];
  assert.deepEqual(after, before, 'including fixed start date and timestamps');
  assert.deepEqual(question_prior, { a: null, b: null });
  assert.equal(answer_revision, '0');
  assert.equal(question_prior_snapshot, null);
  assert.deepEqual((await db.pool.query('select * from action_log where goal_id = $1', [id])).rows, logs);
  assert.deepEqual(await migrate(db.pool, 'app', url), { target: 'app', app: { applied: [] } });
});

test('migration 0002 rejects existing Goals without inventing a start date or changing rows/schema', async (t) => {
  const db = await createTestDatabase();
  t.after(() => db.close());
  const dir = mkdtempSync(join(tmpdir(), 'futureroi-legacy-migration-'));
  writeFileSync(join(dir, APP_MIGRATIONS[0]!), readFileSync(new URL('../migrations/0001_goal_action_log.sql', import.meta.url)));
  const url = pathToFileURL(`${dir}/`);
  await migrate(db.pool, 'all', url);
  await insertUser(db.pool, 'legacy-owner');
  await db.pool.query(`insert into goal (user_id, title, unit, total_required, initial_progress, session_amount, timezone)
    values ('legacy-owner', 'preserve', 'minutes', 100, 7, 30, 'Pacific/Kiritimati')`);
  writeFileSync(join(dir, APP_MIGRATIONS[1]!), readFileSync(new URL('../migrations/0002_goal_record_start_date.sql', import.meta.url)));
  await assert.rejects(migrate(db.pool, 'app', url), /explicit record_start_date backfill decision/);
  assert.deepEqual((await db.pool.query('select title, initial_progress, timezone from goal')).rows,
    [{ title: 'preserve', initial_progress: 7, timezone: 'Pacific/Kiritimati' }]);
  assert.equal((await db.pool.query(`select count(*)::int as n from information_schema.columns where table_name = 'goal' and column_name = 'record_start_date'`)).rows[0]!.n, 0);
  assert.deepEqual((await db.pool.query('select name from schema_migrations order by name')).rows.map((r) => r.name), [APP_MIGRATIONS[0]]);
});

test('認証table作成後のindex中断をrollbackし、再実行で全field indexまで揃う', async (t) => {
  const db = await createTestDatabase();
  t.after(() => db.close());
  await db.pool.query(`create function interrupt_auth_index() returns event_trigger language plpgsql as $$
    begin
      if to_regclass('public."user"') is not null then
        raise exception 'index interrupted after table creation';
      end if;
    end $$;
    create event trigger interrupt_auth_index on ddl_command_start
    when tag in ('CREATE INDEX') execute function interrupt_auth_index();`);
  await assert.rejects(migrate(db.pool, 'auth'), /index interrupted after table creation/);
  assert.deepEqual(await publicTables(db.pool), [], 'all auth DDL is rolled back');
  await db.pool.query('drop event trigger interrupt_auth_index; drop function interrupt_auth_index()');
  await migrate(db.pool, 'auth');
  const retry = await getMigrations(authSchemaOptions(db.pool));
  assert.deepEqual(retry.toBeCreated, []);
  assert.deepEqual(retry.toBeAdded, []);
  assert.deepEqual(retry.toBeAddedIndexes, []);
  const indexes = (await db.pool.query<{ indexname: string; indexdef: string }>("select indexname, indexdef from pg_indexes where schemaname = 'public'")).rows;
  for (const [name, column] of [['session_userId_idx', '"userId"'], ['account_userId_idx', '"userId"'], ['verification_identifier_idx', 'identifier']]) {
    const index = indexes.find(row => row.indexname === name);
    assert.ok(index, `field index ${name} exists after retry`);
    assert.ok(index.indexdef.includes(`(${column})`), `field index ${name} targets ${column}`);
  }
});

test('空のDBへ db:migrate（認証→アプリ）が通り、2回目は差分なし', async (t) => {
  const db = await createTestDatabase();
  t.after(() => db.close());
  assert.deepEqual(await publicTables(db.pool), []);

  const first = await migrate(db.pool, 'all');
  const tables = await publicTables(db.pool);
  for (const expected of ['user', 'session', 'account', 'verification', 'rateLimit', 'goal', 'action_log', 'schema_migrations']) {
    assert.ok(tables.includes(expected), `table ${expected} should exist`);
  }
  assert.ok(first.auth && first.auth.tablesCreated.includes('user') && first.auth.tablesCreated.includes('rateLimit'));
  assert.deepEqual(first.app, { applied: APP_MIGRATIONS });

  const second = await migrate(db.pool, 'all');
  assert.deepEqual(second, { target: 'all', auth: { tablesCreated: [], columnsAdded: [] }, app: { applied: [] } });
});

test('アプリのmigrationは認証テーブルがないと適用できない（実行順の固定）', async (t) => {
  const db = await createTestDatabase();
  t.after(() => db.close());
  await assert.rejects(migrate(db.pool, 'app'), (e: { code?: string }) => e.code === '42P01'); // undefined_table: "user"
  assert.deepEqual(await publicTables(db.pool), ['schema_migrations']);
  // 認証→アプリの順なら通る
  await migrate(db.pool, 'auth');
  assert.deepEqual(await migrate(db.pool, 'app'), { target: 'app', app: { applied: APP_MIGRATIONS } });
});

test('DB制約: (goal_id, local_date) の重複、DONEでamountなし、SKIPPEDでamountありを拒否する', async (t) => {
  const db = await createTestDatabase();
  t.after(() => db.close());
  await migrate(db.pool);
  await insertUser(db.pool, 'u1');
  const goalId = (await db.pool.query<{ id: string }>(goalInsert, ['u1', '英語 30分', 'minutes', 6000, 0, 30])).rows[0]?.id;
  assert.ok(goalId);

  const log = `insert into action_log (goal_id, local_date, status, amount) values ($1, $2, $3, $4)`;
  assert.equal(await sqlState(db.pool, log, [goalId, '2026-10-05', 'DONE', 30]), 'accepted');
  assert.equal(await sqlState(db.pool, log, [goalId, '2026-10-05', 'SKIPPED', null]), '23505', 'duplicate (goal_id, local_date)');
  assert.equal(await sqlState(db.pool, log, [goalId, '2026-10-04', 'DONE', null]), '23514', 'DONE without amount');
  assert.equal(await sqlState(db.pool, log, [goalId, '2026-10-04', 'DONE', 0]), '23514', 'DONE with amount 0');
  assert.equal(await sqlState(db.pool, log, [goalId, '2026-10-04', 'SKIPPED', 5]), '23514', 'SKIPPED with amount');
  assert.equal(await sqlState(db.pool, log, [goalId, '2026-10-04', 'SKIPPED', null]), 'accepted');
  assert.equal(await sqlState(db.pool, log, [goalId, '2026-10-03', 'UNKNOWN', null]), '23514', 'UNKNOWN is not stored as a row');
});

test('DB制約: goalのtitle長・unit・量の下限と、userとの参照整合', async (t) => {
  const db = await createTestDatabase();
  t.after(() => db.close());
  await migrate(db.pool);
  await insertUser(db.pool, 'u1');
  assert.equal(await sqlState(db.pool, goalInsert, ['u1', 'a'.repeat(100), 'sessions', 1, 0, 1]), 'accepted');
  assert.equal(await sqlState(db.pool, goalInsert, ['u1', 'a'.repeat(101), 'minutes', 1, 0, 1]), '23514', 'title > 100');
  assert.equal(await sqlState(db.pool, goalInsert, ['u1', '', 'minutes', 1, 0, 1]), '23514', 'empty title');
  assert.equal(await sqlState(db.pool, goalInsert, ['u1', 'x', 'hours', 1, 0, 1]), '23514', 'unknown unit');
  assert.equal(await sqlState(db.pool, goalInsert, ['u1', 'x', 'minutes', 0, 0, 1]), '23514', 'total_required 0');
  assert.equal(await sqlState(db.pool, goalInsert, ['u1', 'x', 'minutes', 1, -1, 1]), '23514', 'negative initial_progress');
  assert.equal(await sqlState(db.pool, goalInsert, ['u1', 'x', 'minutes', 1, 0, 0]), '23514', 'session_amount 0');
  assert.equal(await sqlState(db.pool, goalInsert, ['nobody', 'x', 'minutes', 1, 0, 1]), '23503', 'unknown user');
  assert.equal(
    await sqlState(db.pool, `insert into goal (user_id, title, unit, total_required, initial_progress, session_amount, timezone) values ('u1', 'x', 'minutes', 1, 0, 1, 'Asia/Tokyo')`),
    '23502',
    'record_start_date is required (no default after 0002)',
  );
});

test('userの削除でgoalとaction_logが連鎖削除され、更新でupdated_atが進む', async (t) => {
  const db = await createTestDatabase();
  t.after(() => db.close());
  await migrate(db.pool);
  await insertUser(db.pool, 'u1');
  const goalId = (await db.pool.query<{ id: string }>(goalInsert, ['u1', 'x', 'minutes', 100, 0, 10])).rows[0]?.id;
  await db.pool.query(`insert into action_log (goal_id, local_date, status, amount) values ($1, '2026-10-05', 'DONE', 10)`, [goalId]);

  const before = (await db.pool.query<{ updated_at: Date }>('select updated_at from goal where id = $1', [goalId])).rows[0]?.updated_at;
  await new Promise((r) => setTimeout(r, 5));
  await db.pool.query(`update goal set title = 'y' where id = $1`, [goalId]);
  const after = (await db.pool.query<{ updated_at: Date }>('select updated_at from goal where id = $1', [goalId])).rows[0]?.updated_at;
  assert.ok(before && after && after.getTime() > before.getTime(), 'updated_at advances on update');

  await db.pool.query(`delete from "user" where id = 'u1'`);
  const counts = (await db.pool.query<{ goals: number; logs: number }>('select (select count(*) from goal)::int as goals, (select count(*) from action_log)::int as logs')).rows[0];
  assert.deepEqual(counts, { goals: 0, logs: 0 });
});

test('適用済みSQLファイルの内容が変わると失敗し、新しい番号のファイルだけを適用する', async (t) => {
  const db = await createTestDatabase();
  const dir = mkdtempSync(join(tmpdir(), 'futureroi-migrations-'));
  t.after(async () => {
    await db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const dirUrl = pathToFileURL(dir + '/');
  writeFileSync(join(dir, '0001_first.sql'), 'create table t1 (id integer primary key);');
  writeFileSync(join(dir, 'notes.txt'), 'ignored');
  assert.deepEqual(await migrateApp(db.pool, dirUrl), { applied: ['0001_first.sql'] });

  writeFileSync(join(dir, '0002_second.sql'), 'create table t2 (id integer primary key);');
  assert.deepEqual(await migrateApp(db.pool, dirUrl), { applied: ['0002_second.sql'] });

  writeFileSync(join(dir, '0001_first.sql'), 'create table t1 (id integer primary key, changed boolean);');
  await assert.rejects(migrateApp(db.pool, dirUrl), (error: unknown) =>
    error instanceof MigrationChecksumError && /0001_first\.sql の内容が変更されています/.test(error.message));

  // 失敗したファイルはロールバックされ、記録も増えない
  writeFileSync(join(dir, '0001_first.sql'), 'create table t1 (id integer primary key);');
  writeFileSync(join(dir, '0003_broken.sql'), 'create table t3 (id integer primary key); create table t3 (id integer primary key);');
  await assert.rejects(migrateApp(db.pool, dirUrl), (e: { code?: string }) => e.code === '42P07');
  assert.deepEqual((await db.pool.query('select name from schema_migrations order by 1')).rows.map((r) => r.name), ['0001_first.sql', '0002_second.sql']);
  assert.equal(await sqlState(db.pool, 'select 1 from t3'), '42P01');
});

test('同時に2つのmigrateを実行しても、どちらも成功しアプリのmigrationは1回だけ適用される', async (t) => {
  const db = await createTestDatabase();
  const pool = new pg.Pool({ connectionString: db.connectionString, max: 8 });
  t.after(async () => {
    await pool.end();
    await db.close();
  });
  const [a, b] = await Promise.all([migrate(pool), migrate(pool)]);
  assert.deepEqual([...(a.app?.applied ?? []), ...(b.app?.applied ?? [])], APP_MIGRATIONS);
  assert.equal((await pool.query('select count(*)::int as n from schema_migrations')).rows[0]?.n, APP_MIGRATIONS.length);
});

test('認証用poolはint8を安全な整数として数値で返し、アプリ用poolは文字列のまま', async (t) => {
  const db = await createTestDatabase();
  const authPool = createAuthPool({ connectionString: db.connectionString, max: 1 });
  t.after(async () => {
    await authPool.end();
    await db.close();
  });
  const viaAuth = (await authPool.query<{ v: unknown }>('select 1759700000000::int8 as v')).rows[0]?.v;
  assert.equal(viaAuth, 1759700000000);
  assert.equal(typeof viaAuth, 'number');
  const viaApp = (await db.pool.query<{ v: unknown }>('select 1759700000000::int8 as v')).rows[0]?.v;
  assert.equal(viaApp, '1759700000000');
  // 安全な整数範囲の外は失敗させる（黙って丸めない）
  await assert.rejects(authPool.query('select 9007199254740992::int8 as v'), RangeError);
  assert.equal((await authPool.query<{ v: unknown }>('select 9007199254740991::int8 as v')).rows[0]?.v, 9007199254740991);
});
