import assert from 'node:assert/strict';
import test from 'node:test';
import type { Goal } from '../src/contracts/goal.ts';
import { checkGoalFields, isCalendarDate } from '../src/goals/extras.ts';
import { setup, signedInClient } from './helpers/stack.ts';

// #157（Product Spec P-19）：到達予定日（B案）。量は整数分のまま（P-18）で、記録の単位（C案）は採用しない。
// 2026-10-05 15:30 UTC は Asia/Tokyo で 10/6、America/Los_Angeles で 10/5。
const NOW = new Date('2026-10-05T15:30:00Z');
const base = { title: '英語', unit: 'minutes', totalRequired: 3000, sessionAmount: 60, timezone: 'Asia/Tokyo' } as const;
const fieldPaths = (json: Record<string, unknown> | null) =>
  ((json?.error as { fields?: { path: string }[] } | undefined)?.fields ?? []).map((f) => f.path).sort();

test('到達予定日は暦にある日付で、Goalのtimezoneの今日より後だけ', () => {
  assert.equal(isCalendarDate('2027-03-31'), true);
  assert.equal(isCalendarDate('2027-02-30'), false);
  assert.equal(isCalendarDate('2027-13-01'), false);
  assert.deepEqual(checkGoalFields({ today: '2026-10-06', targetDate: '2026-10-07' }), []);
  assert.deepEqual(checkGoalFields({ today: '2026-10-06', targetDate: null }), []);
  assert.deepEqual(checkGoalFields({ today: '2026-10-06', targetDate: '2026-10-06' }).map((e) => e.path), ['body/targetDate']);
});

test('作成：到達予定日を保存して返す。省略すれば到達予定日なし。記録の単位は受け付けない', async (t) => {
  const { stack } = await setup(t, { now: () => NOW });
  const a = await signedInClient(stack.app, 'target-create');

  const plain = (await a.call('POST', '/api/goals', base)).json as unknown as Goal;
  assert.equal(plain.targetDate, null);
  assert.equal('recordUnit' in plain, false);

  const res = await a.call('POST', '/api/goals', { ...base, targetDate: '2027-03-31' });
  assert.equal(res.status, 201, res.body);
  const goal = res.json as unknown as Goal;
  assert.deepEqual([goal.targetDate, goal.sessionAmount], ['2027-03-31', 60]);
  // 再読み込みしても残る
  assert.deepEqual((await a.call('GET', `/api/goals/${goal.id}`)).json, goal);

  // C案の記録の単位は契約にない項目として422（P-19でC案を採用しない）
  assert.equal((await a.call('POST', '/api/goals', { ...base, recordUnit: 'hours' })).status, 422);
});

test('作成：今日以前・暦にない到達予定日は422で、Goalを作らない', async (t) => {
  const { stack } = await setup(t, { now: () => NOW });
  const a = await signedInClient(stack.app, 'target-invalid');
  for (const [body, paths] of [
    [{ ...base, targetDate: '2026-10-06' }, ['body/targetDate']], // Asia/Tokyoの今日
    [{ ...base, targetDate: '2026-10-01' }, ['body/targetDate']],
    [{ ...base, targetDate: '2027-02-30' }, ['body/targetDate']],
    [{ ...base, unit: 'sessions', targetDate: '2026-10-05' }, ['body/targetDate']],
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

test('編集：記録があっても到達予定日を変更・削除でき、違反は全体を変更しない', async (t) => {
  const { db, stack } = await setup(t, { now: () => NOW });
  const a = await signedInClient(stack.app, 'target-patch');
  const goal = (await a.call('POST', '/api/goals', { ...base, targetDate: '2027-03-31' })).json as unknown as Goal;
  await db.pool.query(`insert into action_log (goal_id, local_date, status, amount) values ($1, '2026-10-06', 'DONE', 60)`, [goal.id]);

  const changed = await a.call('PATCH', `/api/goals/${goal.id}`, { targetDate: '2027-06-30' });
  assert.equal(changed.status, 200, changed.body);
  assert.equal((changed.json as unknown as Goal).targetDate, '2027-06-30');
  // 量・累計は分のまま
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

test('timezoneと到達予定日を同時に変えると、変更後timezoneの今日で検査し、拒否時は全体を戻す', async (t) => {
  const { stack } = await setup(t, { now: () => NOW });
  const a = await signedInClient(stack.app, 'target-timezone-patch');
  const goal = (await a.call('POST', '/api/goals', { ...base, targetDate: null })).json as unknown as Goal;
  assert.equal(goal.targetDate, null);
  // 東京では今日だが、変更後のLAでは明日なので保存できる。
  const accepted = await a.call('PATCH', '/api/goals/' + goal.id, { timezone: 'America/Los_Angeles', targetDate: '2026-10-06' });
  assert.equal(accepted.status, 200, accepted.body);
  assert.equal((accepted.json as unknown as Goal).timezone, 'America/Los_Angeles');
  assert.equal((accepted.json as unknown as Goal).targetDate, '2026-10-06');
  const before = (await a.call('GET', '/api/goals/' + goal.id)).json;
  // LAでは明日だが、変更後の東京では今日なので、title・timezoneを含めて変更しない。
  const rejected = await a.call('PATCH', '/api/goals/' + goal.id, { title: '変更しない', timezone: 'Asia/Tokyo', targetDate: '2026-10-06' });
  assert.equal(rejected.status, 422, rejected.body);
  assert.deepEqual(fieldPaths(rejected.json), ['body/targetDate']);
  assert.deepEqual((await a.call('GET', '/api/goals/' + goal.id)).json, before);
});
