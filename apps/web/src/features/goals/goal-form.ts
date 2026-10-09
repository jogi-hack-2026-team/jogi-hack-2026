import type { Goal, GoalCreate, GoalPatch, GoalUnit, QuestionAnswers } from '@contracts';
import { ApiError } from '../../api/client.ts';
import { goalsCopy } from '../../copy/goals.ts';
import { localDateIn } from '../today/day-rollover.ts';

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
  /** 到達予定日（#157、P-19）。YYYY-MM-DD、空は未設定。 */
  targetDate: string;
  /** R-11の2問の回答（任意。null は回答しない、UNKNOWN は経験がない・思い出せない）。 */
  questionPrior: QuestionAnswers;
};

/** 編集の比較元。R-11 の読み取り（?view=r11）で得た回答と版を持つ。 */
export type GoalWithAnswers = Goal & { questionPrior?: QuestionAnswers; answerRevision?: number };

export const NO_ANSWERS: QuestionAnswers = { a: null, b: null };
export type FieldName = keyof FormValues;
export type FieldErrors = Partial<Record<FieldName, string>>;

/** 画面に並ぶ順。エラーの件数を数え、最初のエラー項目へ移るときに使う。 */
export const FIELD_ORDER: readonly FieldName[] = ['title', 'unit', 'totalRequired', 'sessionAmount', 'initialProgress', 'targetDate', 'timezone', 'questionPrior'];

const INT4_MAX = 2_147_483_647;
export const TITLE_MAX = 100;
const e = goalsCopy.errors;

export function emptyValues(timezone: string): FormValues {
  return { title: '', unit: 'minutes', totalRequired: '', sessionAmount: '', initialProgress: '0', timezone, targetDate: '', questionPrior: NO_ANSWERS };
}

export function valuesFromGoal(goal: GoalWithAnswers): FormValues {
  return {
    title: goal.title,
    unit: goal.unit,
    totalRequired: String(goal.totalRequired),
    sessionAmount: String(goal.sessionAmount),
    initialProgress: String(goal.initialProgress),
    timezone: goal.timezone,
    targetDate: goal.targetDate ?? '',
    questionPrior: goal.questionPrior ?? NO_ANSWERS,
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

/**
 * 送る前の検査。編集中で記録があるGoalは、変更できない2項目を検査しない（送らないため）。
 * today は到達予定日の比較に使う「今日」（選んだ timezone の今日）。API でも同じ検査をする。
 * savedTargetDate は編集前の到達予定日。変えていなければ送らないので（toPatchBody）、今日以前になっていても止めない（P-19）。
 */
export function validate(
  values: FormValues,
  { locked = false, today, savedTargetDate }: { locked?: boolean; today?: string; savedTargetDate?: string } = {},
): FieldErrors {
  const errors: FieldErrors = {};
  if (!/\S/.test(values.title)) errors.title = e.titleRequired;
  else if (titleLength(values.title) > TITLE_MAX) errors.title = e.titleTooLong;
  const total = amountError(values.totalRequired, 1);
  if (total) errors.totalRequired = total;
  const session = amountError(values.sessionAmount, 1);
  if (session) errors.sessionAmount = session;
  // YYYY-MM-DD どうしなので文字列の比較で日付の前後が分かる
  if (values.targetDate && (!/^\d{4}-\d{2}-\d{2}$/.test(values.targetDate) || (today !== undefined && values.targetDate !== savedTargetDate && values.targetDate <= today))) {
    errors.targetDate = e.targetDatePast;
  }
  if (!locked) {
    const initial = amountError(values.initialProgress, 0);
    if (initial) errors.initialProgress = initial;
    if (!isValidTimezone(values.timezone)) errors.timezone = e.timezone;
  }
  return errors;
}

/** 到達予定日の条件。表示・送信の両経路から使い、検査のたびに選択中timezoneの今日を求める。 */
export function targetDateChecks(timezone: string, savedTargetDate: string | null | undefined, now: Date): { today?: string; savedTargetDate?: string } {
  const today = localDateIn(timezone, now);
  return { ...(today ? { today } : {}), ...(savedTargetDate !== undefined ? { savedTargetDate: savedTargetDate ?? '' } : {}) };
}

/** 表示時と送信時で同じ検査を使う。選択中のtimezoneと編集の比較元から、日付の条件を毎回組み立てる。 */
export function validateGoalForm(
  values: FormValues,
  { locked = false, baseline, now = new Date() }: { locked?: boolean; baseline?: GoalWithAnswers | undefined; now?: Date } = {},
): FieldErrors {
  return validate(values, { locked, ...targetDateChecks(values.timezone, baseline?.targetDate, now) });
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
    // 未設定の到達予定日は送らない
    ...(values.targetDate ? { targetDate: values.targetDate } : {}),
    // 回答しない問いは null のまま送る（POST は版を送らない。初版は 0）
    questionPrior: values.questionPrior,
  };
}

const sameAnswers = (x: QuestionAnswers, y: QuestionAnswers) => x.a === y.a && x.b === y.b;

/** 編集で、単位か1回の量を変えるか。変えると保存済みの回答は API が取り消す（R-11、#133）。 */
export function changesAnswerContext(values: FormValues, goal: Goal): boolean {
  return values.unit !== goal.unit || int(values.sessionAmount) !== goal.sessionAmount;
}

/**
 * 編集で、回答の欄を押せなくする理由（R-11、#133）。単位か1回の量を変えている間は、回答を送れない（同時に送ると 422）。
 * - withdrawn：保存済みの回答を API が取り消す
 * - notSaved：保存済みの回答はないが、入力しても一緒には保存できない
 */
export function answersLockReason(values: FormValues, goal: GoalWithAnswers): 'withdrawn' | 'notSaved' | null {
  if (!changesAnswerContext(values, goal)) return null;
  return sameAnswers(goal.questionPrior ?? NO_ANSWERS, NO_ANSWERS) ? 'notSaved' : 'withdrawn';
}

/**
 * 古い版で保存できなかった（409）後に最新の Goal を読み直したとき、入力を新しい比較元へ合わせる。
 * 触っていない項目（入力が古い比較元と同じ）は最新の値にし、別の画面での変更を古い値で巻き戻さない。触った項目は入力を残す。
 */
export function rebaseValues(values: FormValues, previous: GoalWithAnswers, latest: GoalWithAnswers): FormValues {
  const before = valuesFromGoal(previous);
  const after = valuesFromGoal(latest);
  const pick = <K extends FieldName>(name: K, edited: boolean): FormValues[K] => (edited ? values[name] : after[name]);
  return {
    title: pick('title', values.title !== before.title),
    unit: pick('unit', values.unit !== before.unit),
    totalRequired: pick('totalRequired', int(values.totalRequired) !== previous.totalRequired),
    sessionAmount: pick('sessionAmount', int(values.sessionAmount) !== previous.sessionAmount),
    initialProgress: pick('initialProgress', int(values.initialProgress) !== previous.initialProgress),
    timezone: pick('timezone', values.timezone !== before.timezone),
    targetDate: pick('targetDate', values.targetDate !== before.targetDate),
    questionPrior: pick('questionPrior', !sameAnswers(values.questionPrior, before.questionPrior)),
  };
}

/** 失敗した再取得にも古いdataが残るため、成功した結果だけを409の新しい比較元にする。 */
export async function reloadLatestGoal(refetch: () => Promise<{ isSuccess: boolean; data: GoalWithAnswers | undefined }>): Promise<GoalWithAnswers | undefined> {
  try {
    const result = await refetch();
    return result.isSuccess ? result.data : undefined;
  } catch {
    // 取得が中断・失敗した場合は入力と競合を保持し、再取得の成功を待つ。
    return undefined;
  }
}

/**
 * 編集で送る内容。変えた項目だけを送る（API は空の変更を 422 にするため、変更がなければ null）。
 * 記録があるGoalでは timezone と initialProgress を送らない。
 * R-11 の回答（#133 の契約）：
 * - 回答を変えたら、両方の問い（変えていない方も）と、比較元の版（expectedAnswerRevision）を送る。撤回は両方 null
 * - 単位か1回の量を変えるときは、回答は送らず（API が取り消す）、版だけを送る。回答を同時に送ると 422
 * - 回答にも単位・1回の量にも触れていなければ、版は送らない（無関係な更新に版を付けると 422）
 */
export function toPatchBody(values: FormValues, goal: GoalWithAnswers): GoalPatch | null {
  const patch: { -readonly [K in keyof GoalPatch]: GoalPatch[K] } = {};
  if (values.title !== goal.title) patch.title = values.title;
  if (values.unit !== goal.unit) patch.unit = values.unit;
  if (int(values.totalRequired) !== goal.totalRequired) patch.totalRequired = int(values.totalRequired);
  if (int(values.sessionAmount) !== goal.sessionAmount) patch.sessionAmount = int(values.sessionAmount);
  // 到達予定日は記録があっても変えられる。空にしたら null で未設定に戻す
  if ((values.targetDate || null) !== (goal.targetDate ?? null)) patch.targetDate = values.targetDate || null;
  if (!goal.hasLogs) {
    if (int(values.initialProgress) !== goal.initialProgress) patch.initialProgress = int(values.initialProgress);
    if (values.timezone !== goal.timezone) patch.timezone = values.timezone;
  }
  if (goal.answerRevision !== undefined) {
    if (changesAnswerContext(values, goal)) {
      patch.expectedAnswerRevision = goal.answerRevision;
    } else if (!sameAnswers(values.questionPrior, goal.questionPrior ?? NO_ANSWERS)) {
      patch.questionPrior = values.questionPrior;
      patch.expectedAnswerRevision = goal.answerRevision;
    }
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

const serverMessage: Record<FieldName, string> = {
  title: e.server,
  unit: e.server,
  targetDate: e.targetDatePast,
  totalRequired: e.positiveInteger,
  sessionAmount: e.positiveInteger,
  initialProgress: e.nonNegativeInteger,
  timezone: e.timezone,
  questionPrior: e.server,
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
    // 回答の版（expectedAnswerRevision）の誤りも、回答の欄のエラーとして出す
    const raw = field.path.replace(/^body\//, '').split('/')[0];
    const name = (raw === 'expectedAnswerRevision' ? 'questionPrior' : raw) as FieldName;
    if (FIELD_ORDER.includes(name) && !errors[name]) errors[name] = locked ? e.locked : serverMessage[name];
  }
  return errors;
}
