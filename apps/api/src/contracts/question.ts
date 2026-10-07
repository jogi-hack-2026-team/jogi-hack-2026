import { Type, type Static } from '@sinclair/typebox';

const strict = { additionalProperties: false } as const;
export const QuestionAnswer = Type.Union([
  Type.Literal('LOW'), Type.Literal('MID'), Type.Literal('HIGH'), Type.Literal('UNKNOWN'), Type.Null(),
]);
export const QuestionAnswers = Type.Object({ a: QuestionAnswer, b: QuestionAnswer }, strict);
export type QuestionAnswers = Static<typeof QuestionAnswers>;
export const AnswerRevision = Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER });
