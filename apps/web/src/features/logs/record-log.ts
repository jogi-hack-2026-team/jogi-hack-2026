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

/** 画面に出す記録の要約（「やった・20分」「休んだ」）。 */
export function describeChoice(choice: RecordChoice, sessionAmount: number, unit: string, restLabel: string): string {
  if (choice.status === 'SKIPPED') return restLabel;
  return `やった・${(choice.amount ?? sessionAmount).toLocaleString('ja-JP')}${unit}`;
}

/**
 * 保存の失敗の種類。どれも「まだ記録されていない」ことを伝え、保存済みに見せない。
 * - signed-out：ログインが切れた（401）
 * - date：記録できる日（今日・昨日、記録開始日以降）から外れた。日付が変わった後に古い画面で押した場合など
 * - failed：通信・サーバーの失敗。同じ内容で再試行できる
 */
export type SaveFailureKind = 'signed-out' | 'date' | 'failed';

export function classifySaveError(error: unknown): SaveFailureKind {
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
}): { todayAmountEditing: boolean; yesterdayLocked: boolean; todayLocked: boolean } {
  // 量の入力は2択を出しているときだけ開いている（別のタブで記録されて2択が消えたら、昨日を止めたままにしない）
  const todayAmountEditing = s.todayAmountEditing && s.todayChoicesShown;
  return {
    todayAmountEditing,
    yesterdayLocked: s.changingToday || todayAmountEditing || s.todaySaving,
    todayLocked: s.yesterdayEditing,
  };
}
