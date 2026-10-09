import assert from 'node:assert/strict';
import { test } from 'node:test';
import { amountFormat, hoursText, minutesFromHoursText } from '../src/copy/amount.ts';

test('時間のGoalは、累計を時間（小数第1位まで）で書き、記録は記録の単位で書く（#157、C案）', () => {
  const byMinutes = amountFormat({ unit: 'minutes', recordUnit: 'minutes' });
  assert.equal(byMinutes.total(1240), '20.7時間');
  assert.equal(byMinutes.total(3000), '50時間');
  assert.equal(byMinutes.record(20), '20分');
  const byHours = amountFormat({ unit: 'minutes', recordUnit: 'hours' });
  assert.equal(byHours.total(1240), '20.7時間');
  assert.equal(byHours.record(90), '1.5時間');
  assert.equal(byHours.recordInHours, true);
  // 回のGoalはすべて回
  const count = amountFormat({ unit: 'sessions', recordUnit: null });
  assert.deepEqual([count.total(1500), count.record(20)], ['1,500回', '20回']);
  // 大きな数は桁区切り
  assert.equal(hoursText(60_000 * 6), '6,000');
});

test('時間の入力を分へ換算する。小数は第1位まで、0以下と読めない入力はnull', () => {
  assert.equal(minutesFromHoursText('1.5'), 90);
  assert.equal(minutesFromHoursText('２'), 120);
  assert.equal(minutesFromHoursText('０．５'), 30);
  assert.equal(minutesFromHoursText('1,000'), 60_000);
  for (const raw of ['', '0', '1.25', '-1', 'abc', '.5']) assert.equal(minutesFromHoursText(raw), null, raw);
});
