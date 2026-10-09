import assert from 'node:assert/strict';
import test from 'node:test';
import type { Goal } from '../src/contracts/goal.ts';
import { checkGoalFields, isCalendarDate } from '../src/goals/extras.ts';
import { setup, signedInClient } from './helpers/stack.ts';

// #157（Product Spec P-18）：到達予定日（B案）と、時間のGoalの記録の単位（C案）。
// 2026-10-05 15:30 UTC は Asia/Tokyo で 10/6、America/Los_Angeles で 10/5。
const NOW = new Date('2026-10-05T15:30:00Z');
const base = { title: '英語', unit: 'minutes', totalRequired: 3000, sessionAmount: 60, timezone: 'Asia/Tokyo' } as const;
const fieldPaths = (json: Record<string, unknown> | null) =>
  ((json?.error as { fields?: { path: string }[] } | undefined)?.fields ?? []).map((f) => f.path).sort();

test('到達予定日は暦にある日付で、Goalのtimezoneの今日より後だけ。回のGoalに時間の単位は付けられない', () => {
  assert.equal(isCalendarDate('2027-03-31'), true);
  assert.equal(isCalendarDate('2027-02-30'), false);
  assert.equal(isCalendarDate('2027-13-01'), false);
  assert.deepEqual(checkGoalFields({ unit: 'minutes', today: '2026-10-06', targetDate: '2026-10-07' }), []);
  assert.deepEqual(checkGoalFields({ unit: 'minutes', today: '2026-10-06', targetDate: null }), []);
  assert.deepEqual(checkGoalFields({ unit: 'minutes', today: '2026-10-06', targetDate: '2026-10-06' }).map((e) => e.path), ['body/targetDate']);
  assert.deepEqual(checkGoalFields({ unit: 'sessions', today: '2026-10-06', recordUnit: 'hours' }).map((e) => e.path), ['body/recordUnit']);
});

test('作成：到達予定日と記録の単位を保存して返す。省略すれば到達予定日なし・分で記録。回のGoalの記録の単位はnull', async (t) => {
  const { stack } = await setup(t, { now: () => NOW });
  const a = await signedInClient(stack.app, 'target-create');

  const plain = (await a.call('POST', '/api/goals', base)).json as unknown as Goal;
  assert.deepEqual([plain.targetDate, plain.recordUnit], [null, 'minutes']);

  const res = await a.call('POST', '/api/goals', { ...base, targetDate: '2027-03-31', recordUnit: 'hours' });
  assert.equal(res.status, 201, res.body);
  const goal = res.json as unknown as Goal;
  assert.deepEqual([goal.targetDate, goal.recordUnit, goal.sessionAmount], ['2027-03-31', 'hours', 60]);
  // 再読み込みしても残る（量は分のまま保存している）
  assert.deepEqual((await a.call('GET', `/api/goals/${goal.id}`)).json, goal);

  const count = (await a.call('POST', '/api/goals', { ...base, unit: 'sessions' })).json as unknown as Goal;
  assert.equal(count.recordUnit, null);
});

test('作成：今日以前・暦にない到達予定日、回のGoalへの時間の単位は422で、Goalを作らない', async (t) => {
  const { stack } = await setup(t, { now: () => NOW });
  const a = await signedInClient(stack.app, 'target-invalid');
  for (const [body, paths] of [
    [{ ...base, targetDate: '2026-10-06' }, ['body/targetDate']], // Asia/Tokyoの今日
    [{ ...base, targetDate: '2026-10-01' }, ['body/targetDate']],
    [{ ...base, targetDate: '2027-02-30' }, ['body/targetDate']],
    [{ ...base, unit: 'sessions', recordUnit: 'hours' }, ['body/recordUnit']],
    [{ ...base, unit: 'sessions', recordUnit: 'minutes', targetDate: '2026-10-05' }, ['body/recordUnit', 'body/targetDate']],
  ] as const) {
    const res = await a.call('POST', '/api/goals', body);
    assert.equal(res.status, 422, JSON.stringify(body));
    assert.equal((res.json?.error as { code: string }).code, 'VALIDATION_ERROR');
    assert.deepEqual(fieldPaths(res.json), [...paths]);
  }
  // Los Angelesでは今日が10/5なので、10/6は「今日より後」
  assert.equal((await a.call('POST', '/api/goals', { ...base, timezone: 'America/Los_Angeles', targetDate: '2026-10-06' })).status, 201);
  assert.equal(((await a.call('GET', '/api/goals')).json as unknown as Goal[]).length, 1);
});

test('編集：記録があっても到達予定日と記録の単位を変更・削除でき、違反は全体を変更しない', async (t) => {
  const { db, stack } = await setup(t, { now: () => NOW });
  const a = await signedInClient(stack.app, 'target-patch');
  const goal = (await a.call('POST', '/api/goals', { ...base, targetDate: '2027-03-31' })).json as unknown as Goal;
  await db.pool.query(`insert into action_log (goal_id, local_date, status, amount) values ($1, '2026-10-06', 'DONE', 60)`, [goal.id]);

  const changed = await a.call('PATCH', `/api/goals/${goal.id}`, { targetDate: '2027-06-30', recordUnit: 'hours' });
  assert.equal(changed.status, 200, changed.body);
  assert.deepEqual([(changed.json as unknown as Goal).targetDate, (changed.json as unknown as Goal).recordUnit], ['2027-06-30', 'hours']);
  // 量・累計は分のまま（記録の単位は入力と表示だけを変える）
  assert.deepEqual([(changed.json as unknown as Goal).sessionAmount, (changed.json as unknown as Goal).progressDone], [60, 60]);

  // nullで未設定に戻す
  const cleared = await a.call('PATCH', `/api/goals/${goal.id}`, { targetDate: null });
  assert.equal(cleared.status, 200, cleared.body);
  assert.equal((cleared.json as unknown as Goal).targetDate, null);

  // 今日以前は422で、一緒に送ったtitleも変えない
  const before = (await a.call('GET', `/api/goals/${goal.id}`)).json;
  const invalid = await a.call('PATCH', `/api/goals/${goal.id}`, { title: '変える', targetDate: '2026-10-06' });
  assert.equal(invalid.status, 422);
  assert.deepEqual(fieldPaths(invalid.json), ['body/targetDate']);
  assert.deepEqual((await a.call('GET', `/api/goals/${goal.id}`)).json, before);
});

test('編集：回へ変えると記録の単位はnull、時間へ戻すと指定がなければ分。回のGoalへ時間の単位を送ると422', async (t) => {
  const { stack } = await setup(t, { now: () => NOW });
  const a = await signedInClient(stack.app, 'target-unit');
  const goal = (await a.call('POST', '/api/goals', { ...base, recordUnit: 'hours' })).json as unknown as Goal;

  const toCount = (await a.call('PATCH', `/api/goals/${goal.id}`, { unit: 'sessions' })).json as unknown as Goal;
  assert.deepEqual([toCount.unit, toCount.recordUnit], ['sessions', null]);
  assert.equal((await a.call('PATCH', `/api/goals/${goal.id}`, { recordUnit: 'hours' })).status, 422);

  const toTime = (await a.call('PATCH', `/api/goals/${goal.id}`, { unit: 'minutes' })).json as unknown as Goal;
  assert.deepEqual([toTime.unit, toTime.recordUnit], ['minutes', 'minutes']);
  const toHours = (await a.call('PATCH', `/api/goals/${goal.id}`, { unit: 'minutes', recordUnit: 'hours' })).json as unknown as Goal;
  assert.equal(toHours.recordUnit, 'hours');
});
