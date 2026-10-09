import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayState, monthCells, recentDays, shiftMonth } from '../src/features/history/calendar.ts';

const logs = [
  { localDate: '2026-10-05', status: 'DONE', amount: 20 },
  { localDate: '2026-10-06', status: 'SKIPPED', amount: null },
];

test('日ごとの状態：やった・休んだ・未記録（休んだとは別）と、記録開始日前・今日より後は印なし', () => {
  assert.equal(dayState('2026-10-05', logs, '2026-10-04', '2026-10-08'), 'done');
  assert.equal(dayState('2026-10-06', logs, '2026-10-04', '2026-10-08'), 'rest');
  assert.equal(dayState('2026-10-07', logs, '2026-10-04', '2026-10-08'), 'unrecorded');
  assert.equal(dayState('2026-10-03', logs, '2026-10-04', '2026-10-08'), 'outside');
  assert.equal(dayState('2026-10-09', logs, '2026-10-04', '2026-10-08'), 'outside');
});

test('直近7日は今日で終わる古い順の日付。月をまたぐ', () => {
  assert.deepEqual(recentDays('2026-10-02'), ['2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
});

test('カレンダーは月曜始まりで、月の前を空ける。前後の月は年をまたぐ', () => {
  // 2026年9月1日は火曜 → 前に1つ空ける。30日まで
  const cells = monthCells('2026-09');
  assert.equal(cells[0], null);
  assert.equal(cells[1], '2026-09-01');
  assert.equal(cells.at(-1), '2026-09-30');
  assert.equal(cells.length, 31);
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
});
