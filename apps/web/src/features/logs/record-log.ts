import type { Log, LogPut, LogStatus } from '@contracts';
import { ApiError } from '../../api/client.ts';
import { isUnauthenticated } from '../../api/http.ts';

/**
 * 記録の保存（R-03・R-04、#79・#80）で、画面から切り離した判定。Node のテストで確かめる。
 * 量の既定値（1回の量）は API が補うため、利用者が量を変えたときだけ amount を送る。
 */

/** 保存しようとしている記録。量は DONE のときだけ持つ（null は「1回の量のまま」）。 */
export type RecordChoice = { status: LogStatus; amount: number | null };

export function toLogPut(choice: RecordChoice): LogPut {
  if (choice.status === 'SKIPPED' || choice.amount === null) return { status: choice.status };
  return { status: 'DONE', amount: choice.amount };
}

/** 画面に出す記録の要約（「やった・20分」「やった・90分」「休んだ」）。amount は記録の単位で量を書く（copy/amount.ts）。 */
export function describeChoice(choice: RecordChoice, sessionAmount: number, amount: (n: number) => string, restLabel: string): string {
  if (choice.status === 'SKIPPED') return restLabel;
  return `やった・${amount(choice.amount ?? sessionAmount)}`;
}

/**
 * 保存の失敗の種類。どれも「まだ記録されていない」ことを伝え、保存済みに見せない。
 * - signed-out：ログインが切れた（401）
 * - date：記録できる日（今日・昨日、記録開始日以降）から外れた。日付が変わった後に古い画面で押した場合など
 * - failed：通信・サーバーの失敗。同じ内容で再試行できる
 */
export type SaveFailureKind = 'signed-out' | 'date' | 'day-changed' | 'failed';

/** Today の操作は API で分かった今日だけに送る。昨日の補完・訂正には適用しない。
 * Goal が先に翌日へ進んだ場合も、Today が先に進んだ場合も、古い表示の日へ送らない。
 * 初回 Today 取得失敗時は、取得できた Goal の今日で記録できる。
 */
export function isCurrentToday(date: string, goalToday?: string, todayDate?: string): boolean {
  return date === goalToday && (todayDate === undefined || date >= todayDate);
}

/** 送信直前に日付が変わった場合も、HTTP を送らず選び直しを案内する。 */
export class TodayDateChangedError extends Error {
  constructor() { super('Today date changed'); }
}

export function classifySaveError(error: unknown): SaveFailureKind {
  if (error instanceof TodayDateChangedError) return 'day-changed';
  if (isUnauthenticated(error)) return 'signed-out';
  if (error instanceof ApiError && error.status === 422) {
    const code = error.body?.error.code;
    if (code === 'LOG_DATE_OUT_OF_WINDOW' || code === 'LOG_DATE_BEFORE_START') return 'date';
  }
  return 'failed';
}

/**
 * 昨日の記録の状態（R-04、#80）。記録済みの昨日だけ「昨日：やった・20分［変更］」から訂正できる。
 * - before-start：昨日が記録開始日より前。補完も訂正も出さない
 * - missing：未記録。既存の「昨日はどうでしたか？」で補完する（出すかどうかは /today の yesterdayMissing に従う）
 * - recorded：記録済み。保存済みの記録（量を含む）を訂正の初期値にする
 */
export type YesterdayRecord = { kind: 'before-start' } | { kind: 'missing' } | { kind: 'recorded'; log: Log };

export function yesterdayRecord(yesterday: string, recordStartDate: string, logs: readonly Log[]): YesterdayRecord {
  // YYYY-MM-DD どうしなので文字列の比較で日付の前後が分かる
  if (yesterday < recordStartDate) return { kind: 'before-start' };
  const log = logs.find((l) => l.localDate === yesterday);
  return log ? { kind: 'recorded', log } : { kind: 'missing' };
}

/** 保存済みの記録を、訂正の初期値（RecordChoice）にする。DONE は保存済みの量のまま（今の1回の量に置き換えない）。 */
export function choiceFromLog(log: Log): RecordChoice {
  return log.status === 'DONE' ? { status: 'DONE', amount: log.amount } : { status: 'SKIPPED', amount: null };
}

/**
 * locked の間は action を実行しない操作にする（#88）。通常の保存だけでなく、失敗後の「もう一度保存」にも同じ排他を効かせるため。
 */
export function unlessLocked(locked: boolean, action: () => void): () => void {
  return () => {
    if (!locked) action();
  };
}

/**
 * 今日と昨日を同時に編集しない（#88の採択条件）。どちらかを編集・保存している間は、もう片方を始めない・送らない。
 * - 今日の編集：記録済みの今日の選び直し（changing）、または記録の2択を出している間の量の入力
 * - 昨日の編集：記録済みの昨日の訂正
 */
export function editLocks(s: {
  changingToday: boolean;
  todayAmountEditing: boolean;
  todayChoicesShown: boolean;
  todaySaving: boolean;
  yesterdayEditing: boolean;
}): { todayAmountEditing: boolean; yesterdayLocked: boolean; todayLocked: boolean; cancelChangeLocked: boolean } {
  // 量の入力は2択を出しているときだけ開いている（別のタブで記録されて2択が消えたら、昨日を止めたままにしない）
  const todayAmountEditing = s.todayAmountEditing && s.todayChoicesShown;
  return {
    todayAmountEditing,
    yesterdayLocked: s.changingToday || todayAmountEditing || s.todaySaving,
    todayLocked: s.yesterdayEditing,
    // 今日の保存中は「変更をやめる」で選び直しを閉じない。閉じて保存の状態を消すと、遅れて届いた失敗と再試行を見失う
    cancelChangeLocked: s.todaySaving,
  };
}

/**
 * 決めた総量に届いた日（デザイン D6）。初期量から記録の DONE を日付順に足し、総量に届いた最初の日。
 * 初期量だけで届いていれば null（記録開始前に届いていた）。届いていなければ undefined。
 * 記録の事実をたどるだけで、予測の計算はしない。
 */
export function reachedDate(initialProgress: number, totalRequired: number, logs: readonly Log[]): string | null | undefined {
  if (initialProgress >= totalRequired) return null;
  let done = initialProgress;
  for (const log of [...logs].sort((a, b) => (a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0))) {
    if (log.status !== 'DONE') continue;
    done += log.amount ?? 0;
    if (done >= totalRequired) return log.localDate;
  }
  return undefined;
}
