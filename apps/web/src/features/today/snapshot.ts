import type { Goal, Log, TodayR11 as Today } from '@contracts';

/**
 * Goal・Today・記録の一覧は別々の GET で取るため、取得した時点がずれることがある（別のタブでの編集・記録など）。
 * ずれたまま組み合わせると、見出しは新しい総量・予測と進捗は古い総量、のように食い違う。
 * ここでは3つが同じ時点の材料かを、互いに重なる値で照らし合わせる。食い違えば Today 画面は取り直す。
 * 取得の順番や届いた時刻には頼らず、応答の値だけで決める（初回・編集から戻ったとき・古い応答の遅着・逆順でも同じ判定になる）。
 *
 * 照らし合わせる値（どれも API が同じ snapshot から返す値で、FE で予測を計算し直すものではない）：
 * - 日付：Goal の today と Today の today
 * - 予測に使った設定：R-11 の読み取り（?view=r11）の context（1回の量・単位・記録開始日）と Goal。
 *   総量・累計が一致したまま1回の量だけが変わった組み合わせ（量10で計算した予測と量20の Goal）を止める
 * - 総量：Goal の totalRequired と予測の progress.total
 * - 実績：Goal の initialProgress ＋ 記録開始日から今日までの DONE の量 と 予測の progress.done
 * - 今日の記録：記録の一覧の今日の行と Today の todayLog、Goal の todayStatus と予測の todayStatus
 * - 昨日の記録の有無：Today の yesterdayMissing と、記録の一覧に昨日の行があるか（昨日が記録開始日以降のとき）
 */
export function isSameSnapshot(goal: Goal, today: Today, logs: readonly Log[]): boolean {
  if (goal.today !== today.today) return false;
  const { context } = today;
  if (context.sessionAmount !== goal.sessionAmount || context.unit !== goal.unit || context.recordStartDate !== goal.recordStartDate) return false;
  if (goal.totalRequired !== today.prediction.progress.total) return false;
  if (goal.todayStatus !== today.prediction.todayStatus) return false;

  const done = logs
    .filter((log) => log.status === 'DONE' && log.localDate >= goal.recordStartDate && log.localDate <= today.today)
    .reduce((sum, log) => sum + (log.amount ?? 0), goal.initialProgress);
  if (done !== today.prediction.progress.done) return false;

  // YYYY-MM-DD どうしなので文字列の比較で日付の前後が分かる
  const yesterdayMissing = today.yesterday >= goal.recordStartDate && !logs.some((log) => log.localDate === today.yesterday);
  if (yesterdayMissing !== today.yesterdayMissing) return false;

  const todayLog = logs.find((log) => log.localDate === today.today) ?? null;
  return sameLog(todayLog, today.todayLog);
}

function sameLog(a: Log | null, b: Log | null): boolean {
  if (a === null || b === null) return a === b;
  return a.localDate === b.localDate && a.status === b.status && a.amount === b.amount;
}
