import type { Goal, GoalCreate, GoalPatch, GoalUnit, QuestionAnswers, RecordUnit } from '@contracts';
import { ApiError } from '../../api/client.ts';
import { hoursText, minutesFromHoursText } from '../../copy/amount.ts';
import { goalsCopy } from '../../copy/goals.ts';

/**
 * Goal の作成・編集フォームの値と検査（R-02、#78）。画面から切り離し、Node のテストで確かめられるようにする。
 * 検査の範囲は API 契約（contracts/goal.ts）と同じにし、送る前に項目ごとのエラーを出す。
 * 契約と食い違ったときのために、API の 422（fields）も同じ項目へ割り当てる。
 */

/**
 * 入力中の値。数は画面に出す単位の文字のまま持ち、送るときに分（回のGoalは回）の整数へ変える（#157、C案）。
 * - 時間のGoal（unit = minutes）：総量・記録開始前の量は時間、1回の量は記録の単位（分か時間）
 * - 回のGoal：すべて回
 */
export type FormValues = {
  title: string;
  unit: GoalUnit;
  /** 時間のGoalの記録の単位。回のGoalでは使わない。 */
  recordUnit: RecordUnit;
  totalRequired: string;
  sessionAmount: string;
  initialProgress: string;
  timezone: string;
  /** 到達予定日（#157、B案）。YYYY-MM-DD、空は未設定。 */
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
export const FIELD_ORDER: readonly FieldName[] = ['title', 'unit', 'recordUnit', 'totalRequired', 'sessionAmount', 'targetDate', 'initialProgress', 'timezone', 'questionPrior'];

const INT4_MAX = 2_147_483_647;
export const TITLE_MAX = 100;
const e = goalsCopy.errors;

export function emptyValues(timezone: string): FormValues {
  return { title: '', unit: 'minutes', recordUnit: 'minutes', totalRequired: '', sessionAmount: '', initialProgress: '0', timezone, targetDate: '', questionPrior: NO_ANSWERS };
}

/** 保存値（分）を、時間の入力欄の文字にする（桁区切りは付けない）。 */
const asHours = (minutes: number) => hoursText(minutes).replace(/,/g, '');

export function valuesFromGoal(goal: GoalWithAnswers): FormValues {
  const time = goal.unit === 'minutes';
  const recordUnit: RecordUnit = goal.recordUnit ?? 'minutes';
  return {
    title: goal.title,
    unit: goal.unit,
    recordUnit,
    totalRequired: time ? asHours(goal.totalRequired) : String(goal.totalRequired),
    sessionAmount: time && recordUnit === 'hours' ? asHours(goal.sessionAmount) : String(goal.sessionAmount),
    initialProgress: time ? asHours(goal.initialProgress) : String(goal.initialProgress),
    timezone: goal.timezone,
    targetDate: goal.targetDate ?? '',
    questionPrior: goal.questionPrior ?? NO_ANSWERS,
  };
}

export type AmountField = 'totalRequired' | 'sessionAmount' | 'initialProgress';

/** その項目を時間で入力するか（時間のGoalの総量・記録開始前の量、記録の単位が時間のときの1回の量）。 */
export function inputInHours(values: Pick<FormValues, 'unit' | 'recordUnit'>, field: AmountField): boolean {
  if (values.unit !== 'minutes') return false;
  return field === 'sessionAmount' ? values.recordUnit === 'hours' : true;
}

/** 入力の文字を保存値（分か回）の整数へ。読めなければ null（時間は小数第1位まで）。 */
export function amountFromInput(values: FormValues, field: AmountField): number | null {
  const raw = values[field];
  if (!inputInHours(values, field)) return parseInteger(raw);
  // 記録開始前の量は0時間も受け付ける
  if (field === 'initialProgress' && /^\s*[0０]+(?:[.．][0０])?\s*$/.test(raw)) return 0;
  return minutesFromHoursText(raw);
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

function amountError(values: FormValues, field: AmountField, minimum: 0 | 1): string | undefined {
  const value = amountFromInput(values, field);
  const hours = inputInHours(values, field);
  if (value === null || value < minimum) {
    if (hours) return minimum === 1 ? e.positiveHours : e.nonNegativeHours;
    return minimum === 1 ? e.positiveInteger : e.nonNegativeInteger;
  }
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
 * today は到達予定日の比較に使う「今日」（作成は端末の今日、編集はGoalの timezone の今日）。API でも同じ検査をする。
 */
export function validate(values: FormValues, { locked = false, today }: { locked?: boolean; today?: string } = {}): FieldErrors {
  const errors: FieldErrors = {};
  if (!/\S/.test(values.title)) errors.title = e.titleRequired;
  else if (titleLength(values.title) > TITLE_MAX) errors.title = e.titleTooLong;
  const total = amountError(values, 'totalRequired', 1);
  if (total) errors.totalRequired = total;
  const session = amountError(values, 'sessionAmount', 1);
  if (session) errors.sessionAmount = session;
  // YYYY-MM-DD どうしなので文字列の比較で日付の前後が分かる
  if (values.targetDate && (!/^\d{4}-\d{2}-\d{2}$/.test(values.targetDate) || (today !== undefined && values.targetDate <= today))) {
    errors.targetDate = e.targetDatePast;
  }
  if (!locked) {
    const initial = amountError(values, 'initialProgress', 0);
    if (initial) errors.initialProgress = initial;
    if (!isValidTimezone(values.timezone)) errors.timezone = e.timezone;
  }
  return errors;
}

export const errorCount = (errors: FieldErrors) => FIELD_ORDER.filter((name) => errors[name]).length;

/** 送る保存値（分か回）。検査を通った後だけ呼ぶので、読めない入力は0にする。 */
const amount = (values: FormValues, field: AmountField) => amountFromInput(values, field) ?? 0;

/**
 * 量を変えたか。時間で出す欄は分を小数第1位へ丸めて見せる（400分→6.7時間）ので、保存値と換算し直した値を比べると
 * 触っていないのに変わったことになる（6.7時間→402分）。入力の文字が保存値を出した文字のままなら、変えていないとみなす。
 */
function amountChanged(values: FormValues, goal: GoalWithAnswers, field: AmountField): boolean {
  // 記録の単位を切り替えた場合も、保存値をいまの記録の単位で出した文字と比べる（20分→0.3時間のまま保存すれば20分を保つ）
  const shown = valuesFromGoal({ ...goal, recordUnit: values.unit === 'minutes' ? (values.recordUnit ?? 'minutes') : goal.recordUnit });
  if (values.unit === goal.unit && values[field] === shown[field]) return false;
  return amount(values, field) !== goal[field];
}

/**
 * 記録の単位を切り替える。1回の量の入力を新しい単位へ換算し、量を保つ（20分→0.3時間）。
 * 読めない入力はそのまま残す（検査で知らせる）。
 */
export function switchRecordUnit(values: FormValues, next: RecordUnit): FormValues {
  if (values.recordUnit === next) return values;
  const minutes = amountFromInput(values, 'sessionAmount');
  const switched = { ...values, recordUnit: next };
  if (minutes === null) return switched;
  return { ...switched, sessionAmount: next === 'hours' ? asHours(minutes) : String(minutes) };
}

export function toCreateBody(values: FormValues): GoalCreate {
  return {
    title: values.title,
    unit: values.unit,
    totalRequired: amount(values, 'totalRequired'),
    sessionAmount: amount(values, 'sessionAmount'),
    initialProgress: amount(values, 'initialProgress'),
    timezone: values.timezone,
    // 未設定の到達予定日は送らない。記録の単位は時間のGoalだけ（回のGoalに付けると 422）
    ...(values.targetDate ? { targetDate: values.targetDate } : {}),
    ...(values.unit === 'minutes' ? { recordUnit: values.recordUnit ?? 'minutes' } : {}),
    // 回答しない問いは null のまま送る（POST は版を送らない。初版は 0）
    questionPrior: values.questionPrior,
  };
}

const sameAnswers = (x: QuestionAnswers, y: QuestionAnswers) => x.a === y.a && x.b === y.b;

/** 編集で、単位か1回の量を変えるか。変えると保存済みの回答は API が取り消す（R-11、#133）。 */
export function changesAnswerContext(values: FormValues, goal: Goal): boolean {
  return values.unit !== goal.unit || amountChanged(values, goal, 'sessionAmount');
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
    recordUnit: pick('recordUnit', values.recordUnit !== before.recordUnit),
    totalRequired: pick('totalRequired', amountChanged(values, previous, 'totalRequired')),
    sessionAmount: pick('sessionAmount', amountChanged(values, previous, 'sessionAmount')),
    initialProgress: pick('initialProgress', amountChanged(values, previous, 'initialProgress')),
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
  if (amountChanged(values, goal, 'totalRequired')) patch.totalRequired = amount(values, 'totalRequired');
  if (amountChanged(values, goal, 'sessionAmount')) patch.sessionAmount = amount(values, 'sessionAmount');
  // 記録の単位は時間のGoalだけ（回のGoalへ送ると 422）。回から時間へ変えるときも、選んだ単位が保存と違えば送る
  if (values.unit === 'minutes' && (values.recordUnit ?? 'minutes') !== (goal.recordUnit ?? 'minutes')) patch.recordUnit = values.recordUnit;
  // 到達予定日は記録があっても変えられる。空にしたら null で未設定に戻す
  if ((values.targetDate || null) !== (goal.targetDate ?? null)) patch.targetDate = values.targetDate || null;
  if (!goal.hasLogs) {
    if (amountChanged(values, goal, 'initialProgress')) patch.initialProgress = amount(values, 'initialProgress');
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
  recordUnit: e.server,
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
