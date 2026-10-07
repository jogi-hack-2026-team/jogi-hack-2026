import type { LogPut, LogStatus } from '@contracts';
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
