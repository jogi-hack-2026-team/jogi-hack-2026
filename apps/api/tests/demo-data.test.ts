import test from 'node:test';
import assert from 'node:assert/strict';
import { predict, type PredictionInput } from '@futureroi/prediction';
import { createDemoSeedData } from '../src/db/demo-data.ts';

// examplesはbuild済みruntimeへ同梱されない。既存fixtureとの一致はテストだけで確かめる。
const { demoInputs } = await import(new URL('../../../packages/prediction/examples/demo-inputs.mjs', import.meta.url).href) as {
  demoInputs: { name: string; input: PredictionInput }[];
};

test('元fixtureの2パターン・30日・DONE15・量を保持し、昨日と今日を空ける', () => {
  const data = createDemoSeedData(new Date('2026-10-01T00:00:00Z'), 'UTC');
  assert.deepEqual(data.map(row => row.slot), demoInputs.map(row => row.name));
  for (const [i, row] of data.entries()) {
    assert.deepEqual(row.input.goal, demoInputs[i]!.input.goal);
    assert.deepEqual(row.input.logs.map(({ status, amount }) => ({ status, amount })),
      demoInputs[i]!.input.logs.map(({ status, amount }) => ({ status, amount })));
    assert.deepEqual(row.input.logs.map(log => log.localDate), ['2026-08-31', ...Array.from({ length: 29 }, (_, j) => `2026-09-${String(j + 1).padStart(2, '0')}`)]);
    assert.equal(row.input.logs.filter(log => log.status === 'DONE').length, 15);
    assert.equal(row.recordStartDate, '2026-08-31');
    assert.equal(row.input.today, '2026-10-01');
    assert.ok(row.input.logs.every(log => log.localDate < '2026-09-30'));
  }
});

test('昨日UNKNOWNは遷移を増やさず、中心指標と完了予測は既存fixtureに一致する', () => {
  const results = createDemoSeedData(new Date('2026-10-01T00:00:00Z'), 'UTC').map(({ input }, index) => {
    const original = predict(demoInputs[index]!.input);
    const result = predict(input);
    assert.deepEqual(result.coreMetric, original.coreMetric);
    assert.deepEqual(result.completion, original.completion);
    assert.deepEqual(result.progress, { done: 15, total: 60, completed: false });
    assert.equal(result.todayStatus, 'UNRECORDED');
    assert.deepEqual(result.observations, { ...original.observations, observedDays: 31 });
    return result;
  });
  assert.notDeepEqual(results[0]!.completion, results[1]!.completion);
});

test('timezoneごとの暦日と東京の午前0時を使い、UTCの日付と混同しない', () => {
  const cases = [
    ['2026-12-31T14:59:59.999Z', 'Asia/Tokyo', '2026-12-31', '2026-11-30', '2026-12-29'],
    ['2026-12-31T15:00:00.000Z', 'Asia/Tokyo', '2027-01-01', '2026-12-01', '2026-12-30'],
    ['2026-12-31T15:00:00.000Z', 'UTC', '2026-12-31', '2026-11-30', '2026-12-29'],
    ['2026-12-31T10:00:00.000Z', 'Pacific/Kiritimati', '2027-01-01', '2026-12-01', '2026-12-30'],
  ] as const;
  for (const [instant, timezone, today, first, last] of cases) {
    for (const row of createDemoSeedData(new Date(instant), timezone)) {
      assert.equal(row.input.today, today);
      assert.equal(row.recordStartDate, first);
      assert.equal(row.input.logs.at(-1)!.localDate, last);
      assert.equal(row.input.logs.length, 30);
    }
  }
});

test('閏日・月末・年末・DST・西暦100年でも30暦日に重複や欠落がない', () => {
  const cases = [
    ['2024-03-02T00:00:00Z', 'UTC', '2024-01-31', '2024-02-29'],
    ['2025-03-02T00:00:00Z', 'UTC', '2025-01-30', '2025-02-28'],
    ['2027-01-02T00:00:00Z', 'UTC', '2026-12-02', '2026-12-31'],
    ['2026-03-09T12:00:00Z', 'America/New_York', '2026-02-06', '2026-03-07'],
    ['2026-11-02T12:00:00Z', 'America/New_York', '2026-10-02', '2026-10-31'],
    ['0100-03-02T00:00:00Z', 'UTC', '0100-01-30', '0100-02-28'],
  ] as const;
  for (const [instant, timezone, first, last] of cases) {
    for (const row of createDemoSeedData(new Date(instant), timezone)) {
      const dates = row.input.logs.map(log => log.localDate);
      assert.equal(dates[0], first);
      assert.equal(dates.at(-1), last);
      assert.equal(new Set(dates).size, 30);
      for (let i = 1; i < dates.length; i++) assert.equal(Date.parse(`${dates[i]}T00:00:00Z`) - Date.parse(`${dates[i - 1]}T00:00:00Z`), 86400000);
    }
  }
});

test('再生成は再現し、返却値の変更は次回や別Goalへ漏れない', () => {
  const instant = new Date('2026-10-01T00:00:00Z');
  const expected = createDemoSeedData(instant, 'UTC');
  const changed = createDemoSeedData(instant, 'UTC');
  changed[0]!.input.logs[0]!.amount = 99;
  changed[0]!.input.goal.totalRequired = 999;
  assert.deepEqual(createDemoSeedData(instant, 'UTC'), expected);
  assert.deepEqual(changed[1], expected[1]);
  assert.equal(instant.toISOString(), '2026-10-01T00:00:00.000Z');
});

test('不正時刻・timezone・履歴の日付範囲外を拒否する', () => {
  assert.throws(() => createDemoSeedData(new Date(NaN), 'UTC'), RangeError);
  for (const timezone of ['JST', '+09:00', 'invalid/timezone', '']) assert.throws(() => createDemoSeedData(new Date('2026-10-01T00:00:00Z'), timezone), RangeError);
  for (const [instant, timezone] of [['0001-01-01T00:00:00Z', 'UTC'], ['0001-01-01T00:00:00Z', 'America/Los_Angeles'], ['+010000-01-01T00:00:00Z', 'UTC']]) {
    assert.throws(() => createDemoSeedData(new Date(instant!), timezone!), RangeError);
  }
});
