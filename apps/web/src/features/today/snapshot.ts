import type { Goal, Log, Today } from '@contracts';

/**
 * Goal・Today・記録の一覧は別々の GET で取るため、取得した時点がずれることがある（別のタブでの編集・記録など）。
 * ずれたまま組み合わせると、見出しは新しい総量・予測と進捗は古い総量、のように食い違う。
 * ここでは3つが同じ時点の材料かを、互いに重なる値で照らし合わせる。食い違えば Today 画面は取り直す。
 *
 * 照らし合わせる値（どれも API が同じ snapshot から返す値で、FE で予測を計算し直すものではない）：
 * - 日付：Goal の today と Today の today
 * - 総量：Goal の totalRequired と予測の progress.total
 * - 実績：Goal の initialProgress ＋ 記録開始日から今日までの DONE の量 と 予測の progress.done
 * - 今日の記録：記録の一覧の今日の行と Today の todayLog、Goal の todayStatus と予測の todayStatus
 */
export function isSameSnapshot(goal: Goal, today: Today, logs: readonly Log[]): boolean {
  if (goal.today !== today.today) return false;
  if (goal.totalRequired !== today.prediction.progress.total) return false;
  if (goal.todayStatus !== today.prediction.todayStatus) return false;

  const done = logs
    .filter((log) => log.status === 'DONE' && log.localDate >= goal.recordStartDate && log.localDate <= today.today)
    .reduce((sum, log) => sum + (log.amount ?? 0), goal.initialProgress);
  if (done !== today.prediction.progress.done) return false;

  const todayLog = logs.find((log) => log.localDate === today.today) ?? null;
  return sameLog(todayLog, today.todayLog);
}

function sameLog(a: Log | null, b: Log | null): boolean {
  if (a === null || b === null) return a === b;
  return a.localDate === b.localDate && a.status === b.status && a.amount === b.amount;
}

/**
 * 予測の材料になる Goal の設定（1回の量・単位・記録開始日・初期実績・総量・timezone）を1つの値にしたもの。
 * 通常の /today の応答はこれらを返さないため、isSameSnapshot では照らし合わせられない。
 * 代わりに、表示中の Goal からこの値が変わったのに、Today がその Goal より前に取得したものなら、
 * 古い設定で作った予測かもしれないとして使わずに取り直す（useTodayData.ts）。
 */
export function predictionInputs(goal: Goal): string {
  return JSON.stringify([goal.sessionAmount, goal.unit, goal.recordStartDate, goal.initialProgress, goal.totalRequired, goal.timezone]);
}

/**
 * 設定が変わった Goal と、その Goal より前に取得した Today を組み合わせていないか。
 * shownGoal は最後にそろっていた Goal、goalAt・todayAt はそれぞれの取得が届いた時刻。
 */
export function isTodayOlderThanSettings(shownGoal: Goal | undefined, goal: Goal, goalAt: number, todayAt: number): boolean {
  if (!shownGoal || predictionInputs(shownGoal) === predictionInputs(goal)) return false;
  return todayAt < goalAt;
}
