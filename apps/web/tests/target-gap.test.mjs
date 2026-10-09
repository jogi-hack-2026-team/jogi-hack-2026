import assert from 'node:assert/strict';
import { test } from 'node:test';
import { targetGap, targetGapText } from '../src/features/today/target-gap.ts';
import { outlookAxis } from '../src/features/today/chart-geometry.ts';

// 今日 2026-10-05（月）。到達予定日 2027-03-31（水）
const today = '2026-10-05';
const target = '2027-03-31';
const daysTo = (iso) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);

test('ずれは、目安の週の月曜日と到達予定日の差。8週未満は週、それ以上は月で書く（#157、B案）', () => {
  // 3月1日の週（月曜 3/1）：30日早い → 約4週早い
  assert.equal(targetGapText(targetGap(today, daysTo('2027-03-03'), target)), '約4週早い');
  // 2月1日の週：58日早い（8週以上）→ 約2か月早い
  assert.equal(targetGapText(targetGap(today, daysTo('2027-02-04'), target)), '約2か月早い');
  // 4月12日の週：12日遅い → 約2週遅い
  assert.equal(targetGapText(targetGap(today, daysTo('2027-04-14'), target)), '約2週遅い');
  // 7月5日の週：96日遅い → 約3か月遅い
  assert.equal(targetGapText(targetGap(today, daysTo('2027-07-06'), target)), '約3か月遅い');
  // 3月29日の週（月曜 3/29）：2日差 → 到達予定日ごろ
  assert.deepEqual(targetGap(today, daysTo('2027-03-31'), target), { kind: 'near' });
  // 3年より先（日数なし）はずれを出さない
  assert.equal(targetGap(today, null, target), null);
});

test('日付の軸は、到達予定日が見通しより先ならそこまで伸ばし、今日以前なら印を出さない', () => {
  const axis = outlookAxis(today, 30, 60, false, 350, daysTo(target));
  assert.ok(axis.target && axis.target.x <= axis.axisRight && axis.target.x > axis.markers[1].x);
  assert.equal(outlookAxis(today, 30, 60, false, 350, 0).target, null);
  assert.equal(outlookAxis(today, 30, 60, false, 350).target, null);
});
