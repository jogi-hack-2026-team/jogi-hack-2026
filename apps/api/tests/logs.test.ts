import assert from 'node:assert/strict';
import test from 'node:test';
import type { Goal } from '../src/contracts/goal.ts';
import type { Log } from '../src/contracts/log.ts';
import { isCalendarDate, shiftLocalDate } from '../src/goals/local-date.ts';
import { setup, signedInClient } from './helpers/stack.ts';

// 記録API（R-03・R-04・P-14、#77）。今日・昨日かつ記録開始日以降の窓、DONE量の補完、同日上書き、所有者条件、日付境界を確かめる。

const validGoal = { title: '英語 30分', unit: 'minutes', totalRequired: 6000, sessionAmount: 30, timezone: 'Asia/Tokyo' } as const;
const fieldPaths = (json: Record<string, unknown> | null) =>
  ((json?.error as { fields?: { path: string }[] } | undefined)?.fields ?? []).map((f) => f.path);
const code = (json: Record<string, unknown> | null) => (json?.error as { code: string } | undefined)?.code;

test('shiftLocalDate / isCalendarDate: 月末・うるう年・不正な日付', () => {
  assert.equal(shiftLocalDate('2026-10-06', -1), '2026-10-05');
  assert.equal(shiftLocalDate('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftLocalDate('2028-03-01', -1), '2028-02-29');
  assert.equal(shiftLocalDate('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftLocalDate('2026-12-31', 1), '2027-01-01');
  for (const d of ['2026-10-06', '2028-02-29', '2000-02-29']) assert.ok(isCalendarDate(d), d);
  for (const d of ['2026-02-30', '2026-13-01', '2026-00-10', '2027-02-29', '1900-02-29', '2026-1-1', '']) assert.ok(!isCalendarDate(d), d);
});

test('今日の記録: DONEはamount省略でsessionAmountを補い、同じ日の再送は1行の上書き、SKIPPEDはNULL', async (t) => {
  // 2026-10-05T15:30:00Z = Asia/Tokyo 10/6 00:30。記録開始日も10/6。
  const { db, stack } = await setup(t, { now: () => new Date('2026-10-05T15:30:00Z') });
  const a = await signedInClient(stack.app, 'log');
  const goal = (await a.call('POST', '/api/goals', validGoal)).json as unknown as Goal;

  const done = await a.call('PUT', `/api/goals/${goal.id}/logs/2026-10-06`, { status: 'DONE' });
  assert.equal(done.status, 200, done.body);
  assert.deepEqual(done.json, { localDate: '2026-10-06', status: 'DONE', amount: 30 });

  const changed = await a.call('PUT', `/api/goals/${goal.id}/logs/2026-10-06`, { status: 'DONE', amount: 45 });
  assert.deepEqual(changed.json, { localDate: '2026-10-06', status: 'DONE', amount: 45 });

  const skipped = await a.call('PUT', `/api/goals/${goal.id}/logs/2026-10-06`, { status: 'SKIPPED' });
  assert.deepEqual(skipped.json, { localDate: '2026-10-06', status: 'SKIPPED', amount: null });

  const rows = await db.pool.query<{ n: number }>('select count(*)::int as n from action_log where goal_id = $1', [goal.id]);
  assert.equal(rows.rows[0]?.n, 1, 'one row per (goal, day)');
  const after = (await a.call('GET', `/api/goals/${goal.id}`)).json as unknown as Goal;
  assert.equal(after.hasLogs, true);
  assert.equal(after.todayStatus, 'SKIPPED');

  // 記録が付いたのでtimezoneは変更できない（#76の規則が記録API経由でも効く）
  assert.equal((await a.call('PATCH', `/api/goals/${goal.id}`, { timezone: 'UTC' })).status, 422);
});

test('入力検証: SKIPPEDにamount、amount 0、未知項目、存在しない日付は422で保存しない', async (t) => {
  const { db, stack } = await setup(t, { now: () => new Date('2026-10-05T15:30:00Z') });
  const a = await signedInClient(stack.app, 'bad');
  const goal = (await a.call('POST', '/api/goals', validGoal)).json as unknown as Goal;
  for (const [date, body, path] of [
    ['2026-10-06', { status: 'SKIPPED', amount: 10 }, 'body/amount'],
    ['2026-10-06', { status: 'DONE', amount: 0 }, 'body/amount'],
    ['2026-10-06', { status: 'DONE', amount: '30' }, 'body/amount'],
    ['2026-10-06', { status: 'UNKNOWN' }, 'body/status'],
    ['2026-10-06', { status: 'DONE', note: 'x' }, 'body/note'],
    ['2026-10-06', {}, 'body/status'],
    ['2026-02-30', { status: 'DONE' }, 'params/localDate'],
    ['20261006', { status: 'DONE' }, 'params/localDate'],
  ] as const) {
    const r = await a.call('PUT', `/api/goals/${goal.id}/logs/${date}`, body);
    assert.equal(r.status, 422, `${date} ${JSON.stringify(body)}`);
    assert.ok(fieldPaths(r.json).includes(path), `${date} ${JSON.stringify(body)} -> ${fieldPaths(r.json)}`);
  }
  assert.equal((await db.pool.query('select count(*)::int as n from action_log')).rows[0]?.n, 0);
});

test('許可窓: 今日・昨日だけ。2日前・明日は422、開始日前の昨日も422', async (t) => {
  let now = new Date('2026-10-05T15:30:00Z'); // Asia/Tokyo 10/6
  const { stack } = await setup(t, { now: () => now });
  const a = await signedInClient(stack.app, 'win');
  const goal = (await a.call('POST', '/api/goals', validGoal)).json as unknown as Goal; // 記録開始日 10/6

  // 開始日が今日なら、昨日は窓内でも開始日前なので422（今日から始めるGoalでは昨日分を追加しない）
  const beforeStart = await a.call('PUT', `/api/goals/${goal.id}/logs/2026-10-05`, { status: 'DONE' });
  assert.equal(beforeStart.status, 422);
  assert.equal(code(beforeStart.json), 'LOG_DATE_BEFORE_START');
  assert.deepEqual(fieldPaths(beforeStart.json), ['params/localDate']);

  // 翌日になれば、開始日（10/6）は昨日として補完できる
  now = new Date('2026-10-06T15:30:00Z'); // Asia/Tokyo 10/7
  assert.equal((await a.call('PUT', `/api/goals/${goal.id}/logs/2026-10-06`, { status: 'SKIPPED' })).status, 200);
  assert.equal((await a.call('PUT', `/api/goals/${goal.id}/logs/2026-10-07`, { status: 'DONE' })).status, 200);

  // さらに翌々日: 3日前（10/6）と2日前（10/7）は窓の外、明日も外
  now = new Date('2026-10-08T15:30:00Z'); // Asia/Tokyo 10/9
  for (const date of ['2026-10-06', '2026-10-07', '2026-10-10']) {
    const r = await a.call('PUT', `/api/goals/${goal.id}/logs/${date}`, { status: 'DONE' });
    assert.equal(r.status, 422, date);
    assert.equal(code(r.json), 'LOG_DATE_OUT_OF_WINDOW', date);
    assert.match(String((r.json?.error as { message: string }).message), /2026-10-09/);
  }
  assert.equal((await a.call('PUT', `/api/goals/${goal.id}/logs/2026-10-08`, { status: 'DONE' })).status, 200, 'yesterday is allowed');
  // 保存済みの10/6・10/7は変わっていない
  const logs = (await a.call('GET', `/api/goals/${goal.id}/logs`)).json as unknown as Log[];
  assert.deepEqual(logs, [
    { localDate: '2026-10-06', status: 'SKIPPED', amount: null },
    { localDate: '2026-10-07', status: 'DONE', amount: 30 },
    { localDate: '2026-10-08', status: 'DONE', amount: 30 },
  ]);
});

test('timezoneの日付境界: Asia/Tokyoの23:59と0:00で今日・昨日が変わる', async (t) => {
  let now = new Date('2026-10-05T14:59:00Z'); // Asia/Tokyo 10/5 23:59
  const { stack } = await setup(t, { now: () => now });
  const a = await signedInClient(stack.app, 'tz');
  const goal = (await a.call('POST', '/api/goals', validGoal)).json as unknown as Goal; // 開始日 10/5
  assert.equal((await a.call('PUT', `/api/goals/${goal.id}/logs/2026-10-05`, { status: 'DONE' })).status, 200);
  assert.equal(code((await a.call('PUT', `/api/goals/${goal.id}/logs/2026-10-06`, { status: 'DONE' })).json), 'LOG_DATE_OUT_OF_WINDOW', 'tomorrow in Tokyo');

  now = new Date('2026-10-05T15:00:00Z'); // Asia/Tokyo 10/6 00:00
  assert.equal((await a.call('PUT', `/api/goals/${goal.id}/logs/2026-10-06`, { status: 'DONE' })).status, 200, 'now today');
  assert.equal((await a.call('PUT', `/api/goals/${goal.id}/logs/2026-10-05`, { status: 'SKIPPED' })).status, 200, 'now yesterday, still editable');
  assert.equal(code((await a.call('PUT', `/api/goals/${goal.id}/logs/2026-10-04`, { status: 'DONE' })).json), 'LOG_DATE_OUT_OF_WINDOW', 'two days ago: window is checked first');

  // ブラウザ側がUTCでも、Goalのtimezone（Los_Angeles）なら同じ瞬間はまだ10/5
  const la = (await a.call('POST', '/api/goals', { ...validGoal, timezone: 'America/Los_Angeles' })).json as unknown as Goal;
  assert.equal(la.today, '2026-10-05');
  assert.equal(code((await a.call('PUT', `/api/goals/${la.id}/logs/2026-10-06`, { status: 'DONE' })).json), 'LOG_DATE_OUT_OF_WINDOW');
  assert.equal((await a.call('PUT', `/api/goals/${la.id}/logs/2026-10-05`, { status: 'DONE' })).status, 200);
});

test('記録一覧: 昇順、from/toは両端を含む、逆転と不正日付は422', async (t) => {
  let now = new Date('2026-10-01T15:30:00Z'); // Asia/Tokyo 10/2
  const { stack } = await setup(t, { now: () => now });
  const a = await signedInClient(stack.app, 'list');
  const goal = (await a.call('POST', '/api/goals', validGoal)).json as unknown as Goal; // 開始日 10/2
  for (const [offset, status] of [[0, 'DONE'], [1, 'SKIPPED'], [2, 'DONE'], [4, 'DONE']] as const) {
    now = new Date(Date.UTC(2026, 9, 1 + offset, 15, 30));
    assert.equal((await a.call('PUT', `/api/goals/${goal.id}/logs/2026-10-0${2 + offset}`, { status })).status, 200);
  }
  const all = (await a.call('GET', `/api/goals/${goal.id}/logs`)).json as unknown as Log[];
  assert.deepEqual(all.map((l) => l.localDate), ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-06']);
  const range = (await a.call('GET', `/api/goals/${goal.id}/logs?from=2026-10-03&to=2026-10-04`)).json as unknown as Log[];
  assert.deepEqual(range.map((l) => l.localDate), ['2026-10-03', '2026-10-04']);
  assert.deepEqual(((await a.call('GET', `/api/goals/${goal.id}/logs?from=2026-10-05`)).json as unknown as Log[]).map((l) => l.localDate), ['2026-10-06']);
  assert.deepEqual(((await a.call('GET', `/api/goals/${goal.id}/logs?to=2026-10-02`)).json as unknown as Log[]).map((l) => l.localDate), ['2026-10-02']);
  assert.deepEqual((await a.call('GET', `/api/goals/${goal.id}/logs?from=2026-11-01`)).json, []);
  assert.equal((await a.call('GET', `/api/goals/${goal.id}/logs?from=2026-10-05&to=2026-10-03`)).status, 422);
  assert.equal((await a.call('GET', `/api/goals/${goal.id}/logs?from=2026-02-30`)).status, 422);
  assert.equal((await a.call('GET', `/api/goals/${goal.id}/logs?limit=3`)).status, 422, 'unknown query parameter');
});

test('所有者チェック: 他人のGoalの記録は保存も一覧も404、別originの保存は403で副作用なし', async (t) => {
  const { db, stack } = await setup(t, { now: () => new Date('2026-10-05T15:30:00Z') });
  const a = await signedInClient(stack.app, 'owner');
  const b = await signedInClient(stack.app, 'other');
  const goal = (await a.call('POST', '/api/goals', validGoal)).json as unknown as Goal;
  assert.equal((await b.call('PUT', `/api/goals/${goal.id}/logs/2026-10-06`, { status: 'DONE' })).status, 404);
  assert.equal((await b.call('GET', `/api/goals/${goal.id}/logs`)).status, 404);
  assert.equal((await a.call('PUT', `/api/goals/not-a-uuid/logs/2026-10-06`, { status: 'DONE' })).status, 404);
  const evil = await stack.app.inject({
    method: 'PUT',
    url: `/api/goals/${goal.id}/logs/2026-10-06`,
    headers: { cookie: a.cookieHeader(), origin: 'http://evil.example', 'content-type': 'application/json' },
    payload: JSON.stringify({ status: 'DONE' }),
  });
  assert.equal(evil.statusCode, 403);
  const encoded = await stack.app.inject({ method: 'PUT', url: `/%61pi/goals/${goal.id}/logs/2026-10-06`, headers: { 'content-type': 'application/json' }, payload: '{"status":"DONE"}' });
  assert.equal(encoded.statusCode, 403);
  assert.equal(encoded.json().error.code, 'ORIGIN_REJECTED');
  assert.equal((await db.pool.query('select count(*)::int as n from action_log')).rows[0]?.n, 0);
});
