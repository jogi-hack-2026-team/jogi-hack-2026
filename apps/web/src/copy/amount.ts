import type { GoalUnit, RecordUnit } from '@contracts';

/*
 * 量の書き方（#157、Product Spec P-18 のC案）。
 * 量はAPI・Engineとも分（回のGoalは回）の整数のまま扱い、ここで画面に出す単位へ換算する。
 * - 時間のGoal（unit = minutes）：累計・総量・残り・記録開始前の量は時間で出す。1回の量と日々の記録は記録の単位（分か時間）で出す
 * - 回のGoal：すべて回
 * 時間は小数第1位まで（6分刻み）。換算は表示と入力のためだけで、FEで予測の数値は計算しない。
 */

export type AmountGoal = { unit: GoalUnit; recordUnit: RecordUnit | null };

const MINUTES_PER_HOUR = 60;

/** 分を時間の数字にする（小数第1位まで。整数なら小数を付けない）。 */
export function hoursText(minutes: number): string {
  return (Math.round(minutes / 6) / 10).toLocaleString('ja-JP', { maximumFractionDigits: 1 });
}

/** 時間の入力（例「1.5」「２」）を分へ。小数は第1位まで、0より大きい値だけ。それ以外は null。 */
export function minutesFromHoursText(text: string): number | null {
  const normalized = text.trim().replace(/[０-９．]/g, (ch) => (ch === '．' ? '.' : String.fromCharCode(ch.charCodeAt(0) - 0xfee0))).replace(/[,，]/g, '');
  if (!/^\d+(\.\d)?$/.test(normalized)) return null;
  const minutes = Math.round(Number(normalized) * MINUTES_PER_HOUR);
  return minutes > 0 ? minutes : null;
}

export type AmountFormat = {
  /** 累計・総量・残りなどの数字（単位なし）。 */
  totalNumber: (amount: number) => string;
  /** 累計・総量・残りなどの単位。 */
  totalUnit: string;
  /** 累計・総量・残りなど（例「20.7時間」「38回」）。 */
  total: (amount: number) => string;
  /** 1回の量・日々の記録の数字（単位なし）。 */
  recordNumber: (amount: number) => string;
  /** 1回の量・日々の記録の単位。 */
  recordUnit: string;
  /** 1回の量・日々の記録（例「20分」「1.5時間」「20回」）。 */
  record: (amount: number) => string;
  /** 記録の単位が時間か（入力欄で小数を受け付ける）。 */
  recordInHours: boolean;
};

const integer = (n: number) => n.toLocaleString('ja-JP');

export function amountFormat(goal: AmountGoal): AmountFormat {
  if (goal.unit === 'sessions') {
    return { totalNumber: integer, totalUnit: '回', total: (n) => `${integer(n)}回`, recordNumber: integer, recordUnit: '回', record: (n) => `${integer(n)}回`, recordInHours: false };
  }
  const recordInHours = goal.recordUnit === 'hours';
  const recordNumber = recordInHours ? hoursText : integer;
  const recordUnit = recordInHours ? '時間' : '分';
  return {
    totalNumber: hoursText,
    totalUnit: '時間',
    total: (n) => `${hoursText(n)}時間`,
    recordNumber,
    recordUnit,
    record: (n) => `${recordNumber(n)}${recordUnit}`,
    recordInHours,
  };
}
