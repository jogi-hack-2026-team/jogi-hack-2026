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

// #187（案C）：到達予定日が「10回中8回（なければ目安）」の3倍より先なら、見通しまでの軸を右端の手前で省き、
// 到達予定日を右端に置く。印が「今日」に詰まらず、右端の到達予定日のラベルの下にも入らないことを、極端な比で確かめる
test('到達予定日が見通しの3倍より先なら軸を省き、印を今日と右端のラベルから離す（#187）', () => {
  for (const width of [322, 350, 358, 600]) {
    for (const [p50, p80, targetDays] of [
      [30, 45, 1000],
      [5, 8, 365],
      [200, null, 1500],
      [1, 1, 100_000],
    ]) {
      const axis = outlookAxis(today, p50, p80, false, width, targetDays);
      const label = `${width}px ${p50}/${p80}/${targetDays}日`;
      assert.ok(axis.cut && axis.target, label);
      assert.equal(axis.target.x, axis.axisRight);
      assert.ok(axis.markers.every((m) => m.x <= axis.axisRight - 170), `${label}：印が右端のラベルの下に入らない`);
      assert.ok(axis.ticks.every((t) => t.x < axis.cut.x), `${label}：目盛りは省いた位置より左`);
      // 省いた内側は日付に比例する（印の間隔の比が日数の比と一致する）
      if (p80 !== null) {
        const r = (axis.markers[1].x - axis.axisLeft) / (axis.markers[0].x - axis.axisLeft);
        assert.ok(Math.abs(r - p80 / p50) < 1e-9, `${label}：比例`);
      }
    }
  }
  // 以前は 350px・30/45/1000日で目安 x≈28、10回中8回 x≈32（今日は x=20）に詰まっていた
  const far = outlookAxis(today, 30, 45, false, 350, 1000);
  assert.ok(far.markers[0].x - far.axisLeft >= 40 && far.markers[1].x - far.markers[0].x >= 40);
});

test('3倍ちょうどまでは省かず、到達予定日まで日付に比例した軸を保つ（#187）', () => {
  const at = outlookAxis(today, 30, 45, false, 350, 135);
  assert.equal(at.cut, null);
  assert.ok(at.target.x < at.axisRight && at.target.x > at.markers[1].x);
  assert.ok(outlookAxis(today, 30, 45, false, 350, 136).cut);
  // 10回中8回がないときは目安の3倍で判定する
  assert.equal(outlookAxis(today, 30, null, false, 350, 90).cut, null);
  assert.ok(outlookAxis(today, 30, null, false, 350, 91).cut);
  // 到達予定日がない・今日以前なら省かない
  assert.equal(outlookAxis(today, 30, 45, false, 350).cut, null);
  assert.equal(outlookAxis(today, 30, 45, false, 350, 0).cut, null);
});
