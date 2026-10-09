import type { GoalUnit, RecordUnit } from '../contracts/goal.ts';

// 到達予定日（B案）と時間のGoalの記録の単位（C案）の検査（#157、Product Spec P-18）。
// 契約（TypeBox）は形だけを見るので、暦にある日付か・Goalのtimezoneの今日より後か・回のGoalに時間の単位を付けていないかをここで見る。

export type GoalFieldError = { path: 'body/targetDate' | 'body/recordUnit'; message: string };

/** 入力の検査に通らなかった。ルートで他の契約違反と同じ422（VALIDATION_ERROR）にする。 */
export class GoalFieldsInvalid extends Error {
  readonly fields: GoalFieldError[];
  constructor(fields: GoalFieldError[]) {
    super('Goal fields are invalid.');
    this.fields = fields;
    this.name = 'GoalFieldsInvalid';
  }
}

/** YYYY-MM-DD が暦にある日付か（2026-02-30 などをDBへ渡して500にしない）。 */
export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * 作成・変更の入力を検査する。
 * - targetDate：送られたとき（nullは未設定に戻すので検査しない）は、暦にある日付で、Goalのtimezoneの今日より後
 * - recordUnit：回のGoal（変更後の単位で判断）には付けられない
 */
export function checkGoalFields(input: { unit: GoalUnit; today: string; targetDate?: string | null | undefined; recordUnit?: RecordUnit | undefined }): GoalFieldError[] {
  const errors: GoalFieldError[] = [];
  if (typeof input.targetDate === 'string') {
    if (!isCalendarDate(input.targetDate)) errors.push({ path: 'body/targetDate', message: 'must be a valid date' });
    // YYYY-MM-DD どうしなので文字列の比較で日付の前後が分かる
    else if (input.targetDate <= input.today) errors.push({ path: 'body/targetDate', message: 'must be after today in the goal timezone' });
  }
  if (input.recordUnit !== undefined && input.unit === 'sessions') {
    errors.push({ path: 'body/recordUnit', message: 'is only for goals measured in time (unit minutes)' });
  }
  return errors;
}
