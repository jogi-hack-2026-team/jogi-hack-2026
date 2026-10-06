import { Type, type Static } from '@sinclair/typebox';

// Goal API（#76）の契約。Architecture「API契約」「Data Model」とProduct R-02に対応する。
// 入力はDBのCHECK制約と同じ範囲をここで先に検証し、違反はすべて422のfieldsへ入れる（AjvはallErrors）。

const strict = { additionalProperties: false } as const;
const INT4_MAX = 2_147_483_647;

export const GoalUnit = Type.Union([Type.Literal('minutes'), Type.Literal('sessions')]);
export type GoalUnit = Static<typeof GoalUnit>;

/** Goalのtimezoneでの暦日（YYYY-MM-DD）。 */
export const LocalDate = Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' });

export const TodayStatus = Type.Union([Type.Literal('DONE'), Type.Literal('SKIPPED'), Type.Literal('UNRECORDED')]);
export type TodayStatus = Static<typeof TodayStatus>;

// 一覧・取得・作成・編集で共通のGoal DTO。DB列をそのまま返さず、画面に必要な導出値を足す。
export const Goal = Type.Object(
  {
    id: Type.String(),
    title: Type.String(),
    unit: GoalUnit,
    totalRequired: Type.Integer(),
    sessionAmount: Type.Integer(),
    initialProgress: Type.Integer(),
    timezone: Type.String(),
    /** 記録開始日。作成時のtimezoneの暦日で固定し、以後動かさない。 */
    recordStartDate: LocalDate,
    /** 記録が1件でもあるか。trueならtimezoneとinitialProgressを変更できない（R-02）。 */
    hasLogs: Type.Boolean(),
    /** 応答時点の、このGoalのtimezoneでの今日。 */
    today: LocalDate,
    /** 今日の記録状態。行がなければUNRECORDED（SKIPPEDとみなさない）。 */
    todayStatus: TodayStatus,
  },
  strict,
);
export type Goal = Static<typeof Goal>;

export const GoalList = Type.Array(Goal);

const title = Type.String({ minLength: 1, maxLength: 100, pattern: '\\S' });
const amount = Type.Integer({ minimum: 1, maximum: INT4_MAX });
const initialProgress = Type.Integer({ minimum: 0, maximum: INT4_MAX });
// IANA名かどうかはschemaで判定できないため、API側（goals/local-date.ts）で検証して422にする。
const timezone = Type.String({ minLength: 1, maxLength: 64 });

export const GoalCreate = Type.Object(
  {
    title,
    unit: GoalUnit,
    totalRequired: amount,
    sessionAmount: amount,
    /** 記録開始日の前日までに終えた量。省略時は0。 */
    initialProgress: Type.Optional(initialProgress),
    timezone,
  },
  strict,
);
export type GoalCreate = Static<typeof GoalCreate>;

// 省略した項目は維持する。nullは受け付けない。空objectは422。
export const GoalPatch = Type.Object(
  {
    title: Type.Optional(title),
    unit: Type.Optional(GoalUnit),
    totalRequired: Type.Optional(amount),
    sessionAmount: Type.Optional(amount),
    initialProgress: Type.Optional(initialProgress),
    timezone: Type.Optional(timezone),
  },
  { ...strict, minProperties: 1 },
);
export type GoalPatch = Static<typeof GoalPatch>;

export const GoalParams = Type.Object({ goalId: Type.String() }, strict);
export type GoalParams = Static<typeof GoalParams>;
