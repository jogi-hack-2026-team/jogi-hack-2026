import type { Goal, GoalCreate, GoalPatch, GoalUnit } from '@contracts';
import { ApiError } from '../../api/client.ts';
import { goalsCopy } from '../../copy/goals.ts';

/**
 * Goal の作成・編集フォームの値と検査（R-02、#78）。画面から切り離し、Node のテストで確かめられるようにする。
 * 検査の範囲は API 契約（contracts/goal.ts）と同じにし、送る前に項目ごとのエラーを出す。
 * 契約と食い違ったときのために、API の 422（fields）も同じ項目へ割り当てる。
 */

/** 入力中の値。数は入力した文字のまま持ち、送るときに整数へ変える。 */
export type FormValues = {
  title: string;
  unit: GoalUnit;
  totalRequired: string;
  sessionAmount: string;
  initialProgress: string;
  timezone: string;
};
export type FieldName = keyof FormValues;
export type FieldErrors = Partial<Record<FieldName, string>>;

/** 画面に並ぶ順。エラーの件数を数え、最初のエラー項目へ移るときに使う。 */
export const FIELD_ORDER: readonly FieldName[] = ['title', 'unit', 'totalRequired', 'sessionAmount', 'initialProgress', 'timezone'];

const INT4_MAX = 2_147_483_647;
export const TITLE_MAX = 100;
const e = goalsCopy.errors;

export function emptyValues(timezone: string): FormValues {
  return { title: '', unit: 'minutes', totalRequired: '', sessionAmount: '', initialProgress: '0', timezone };
}

export function valuesFromGoal(goal: Goal): FormValues {
  return {
    title: goal.title,
    unit: goal.unit,
    totalRequired: String(goal.totalRequired),
    sessionAmount: String(goal.sessionAmount),
    initialProgress: String(goal.initialProgress),
    timezone: goal.timezone,
  };
}

/** タイトルの文字数（API の maxLength と同じく、絵文字なども1文字と数える）。 */
export const titleLength = (title: string) => [...title].length;

/** 全角数字も受け付け、桁区切りのカンマは外す。整数でなければ null。 */
export function parseInteger(raw: string): number | null {
  const text = raw.trim().replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[,，]/g, '');
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : Number.POSITIVE_INFINITY;
}

function amountError(raw: string, minimum: 0 | 1): string | undefined {
  const value = parseInteger(raw);
  if (value === null || value < minimum) return minimum === 1 ? e.positiveInteger : e.nonNegativeInteger;
  if (value > INT4_MAX) return e.tooLarge;
  return undefined;
}

export function isValidTimezone(timezone: string): boolean {
  if (timezone.length === 0 || timezone.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** 送る前の検査。編集中で記録があるGoalは、変更できない2項目を検査しない（送らないため）。 */
export function validate(values: FormValues, { locked = false }: { locked?: boolean } = {}): FieldErrors {
  const errors: FieldErrors = {};
  if (!/\S/.test(values.title)) errors.title = e.titleRequired;
  else if (titleLength(values.title) > TITLE_MAX) errors.title = e.titleTooLong;
  const total = amountError(values.totalRequired, 1);
  if (total) errors.totalRequired = total;
  const session = amountError(values.sessionAmount, 1);
  if (session) errors.sessionAmount = session;
  if (!locked) {
    const initial = amountError(values.initialProgress, 0);
    if (initial) errors.initialProgress = initial;
    if (!isValidTimezone(values.timezone)) errors.timezone = e.timezone;
  }
  return errors;
}

export const errorCount = (errors: FieldErrors) => FIELD_ORDER.filter((name) => errors[name]).length;

const int = (raw: string) => parseInteger(raw) ?? 0;

export function toCreateBody(values: FormValues): GoalCreate {
  return {
    title: values.title,
    unit: values.unit,
    totalRequired: int(values.totalRequired),
    sessionAmount: int(values.sessionAmount),
    initialProgress: int(values.initialProgress),
    timezone: values.timezone,
  };
}

/**
 * 編集で送る内容。変えた項目だけを送る（API は空の変更を 422 にするため、変更がなければ null）。
 * 記録があるGoalでは timezone と initialProgress を送らない。
 */
export function toPatchBody(values: FormValues, goal: Goal): GoalPatch | null {
  const patch: { -readonly [K in keyof GoalPatch]: GoalPatch[K] } = {};
  if (values.title !== goal.title) patch.title = values.title;
  if (values.unit !== goal.unit) patch.unit = values.unit;
  if (int(values.totalRequired) !== goal.totalRequired) patch.totalRequired = int(values.totalRequired);
  if (int(values.sessionAmount) !== goal.sessionAmount) patch.sessionAmount = int(values.sessionAmount);
  if (!goal.hasLogs) {
    if (int(values.initialProgress) !== goal.initialProgress) patch.initialProgress = int(values.initialProgress);
    if (values.timezone !== goal.timezone) patch.timezone = values.timezone;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

const serverMessage: Record<FieldName, string> = {
  title: e.server,
  unit: e.server,
  totalRequired: e.positiveInteger,
  sessionAmount: e.positiveInteger,
  initialProgress: e.nonNegativeInteger,
  timezone: e.timezone,
};

/**
 * API の 422 を項目ごとのエラーへ割り当てる。fields の path は `body/<項目名>`。
 * 記録があるため変更できない（GOAL_HAS_LOGS）ときは、その理由を出す。422 でなければ null。
 */
export function fieldErrorsFromApi(error: unknown): FieldErrors | null {
  if (!(error instanceof ApiError) || error.status !== 422 || !error.body) return null;
  const errors: FieldErrors = {};
  const locked = error.body.error.code === 'GOAL_HAS_LOGS';
  for (const field of error.body.error.fields ?? []) {
    const name = field.path.replace(/^body\//, '').split('/')[0] as FieldName;
    if (FIELD_ORDER.includes(name) && !errors[name]) errors[name] = locked ? e.locked : serverMessage[name];
  }
  return errors;
}
