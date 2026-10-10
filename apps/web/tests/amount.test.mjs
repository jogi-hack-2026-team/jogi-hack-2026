import assert from 'node:assert/strict';
import { test } from 'node:test';
import { amountFormat, hoursMinutes, isRecordAmount, RECORD_AMOUNT_MAX, stepRecordAmount } from '../src/copy/amount.ts';

test('分のGoalの累計・総量・残量は、整数分を正確な時間＋分で書く（P-18の固定例）', () => {
  const cases = [
    [0, '0時間0分'],
    [1, '0時間1分'],
    [59, '0時間59分'],
    [60, '1時間0分'],
    [61, '1時間1分'],
    [1240, '20時間40分'],
  ];
  for (const [minutes, text] of cases) assert.equal(hoursMinutes(minutes), text, String(minutes));
  // 総量3000分に対する実績2999分：小数へ丸めず、残り1分の差が見える
  const fmt = amountFormat({ unit: 'minutes' });
  assert.deepEqual([fmt.total(2999), fmt.total(3000), fmt.total(3000 - 2999)], ['49時間59分', '50時間0分', '0時間1分']);
  // 大きい時間は桁区切りを付ける
  assert.equal(hoursMinutes(60_000 * 6 + 5), '6,000時間5分');
});

test('記録の量はDONE契約の整数範囲で、±はGoalの1回の量を使い境界で止まる', () => {
  for (const value of [null, 0, -1, 1.5, NaN, Infinity, RECORD_AMOUNT_MAX + 1]) assert.equal(isRecordAmount(value), false);
  for (const value of [1, 37, RECORD_AMOUNT_MAX]) assert.equal(isRecordAmount(value), true);
  assert.equal(stepRecordAmount(37, 20, 1), 57);
  assert.equal(stepRecordAmount(37, 20, -1), 17);
  assert.equal(stepRecordAmount(2, 20, -1), 1);
  assert.equal(stepRecordAmount(RECORD_AMOUNT_MAX - 1, 20, 1), RECORD_AMOUNT_MAX);
  assert.equal(stepRecordAmount(3, 2, 1), 5); // 回数Goalも整数・Goal固有の刻み
});

test('1回の量・日々の記録は分のまま、回のGoalはすべて回で書く', () => {
  const minutes = amountFormat({ unit: 'minutes' });
  assert.deepEqual([minutes.record(20), minutes.record(1500), minutes.recordUnit], ['20分', '1,500分', '分']);
  const count = amountFormat({ unit: 'sessions' });
  assert.deepEqual([count.total(38), count.record(20), count.recordUnit], ['38回', '20回', '回']);
});

test('積み上げの図の目盛り：3時間以上の分のGoalは1時間刻みで時間の数、短いGoalと回のGoalはそのままの数', () => {
  const long = amountFormat({ unit: 'minutes' }).axis(3000);
  assert.deepEqual([long.unit, long.gridUnit, long.label(1020)], ['時間', 60, '17']);
  const short = amountFormat({ unit: 'minutes' }).axis(120);
  assert.deepEqual([short.unit, short.gridUnit, short.label(40)], ['分', 1, '40']);
  const count = amountFormat({ unit: 'sessions' }).axis(100);
  assert.deepEqual([count.unit, count.gridUnit, count.label(33)], ['回', 1, '33']);
});
