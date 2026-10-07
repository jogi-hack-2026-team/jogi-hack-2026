// Supporting Artifact / Not a Source of Truth (Issue #84).
// Spike subset of the HTTP contract, expressed once as TypeBox schemas and shared by the
// Fastify routes (runtime validation + response serialization) and the web client (types).
import { Type, type Static } from '@sinclair/typebox';

const strict = { additionalProperties: false } as const;

export const ErrorBody = Type.Object(
  {
    error: Type.Object(
      {
        code: Type.String(),
        message: Type.String(),
        fields: Type.Optional(Type.Array(Type.Object({ path: Type.String(), message: Type.String() }, strict))),
      },
      strict,
    ),
  },
  strict,
);
export type ErrorBody = Static<typeof ErrorBody>;

export const Goal = Type.Object(
  {
    id: Type.String(),
    title: Type.String(),
    unit: Type.Union([Type.Literal('minutes'), Type.Literal('count')]),
    totalRequired: Type.Number(),
    sessionAmount: Type.Number(),
    initialProgress: Type.Number(),
    timezone: Type.String(),
  },
  strict,
);
export type Goal = Static<typeof Goal>;

export const GoalCreate = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: 120 }),
    unit: Type.Union([Type.Literal('minutes'), Type.Literal('count')]),
    totalRequired: Type.Number({ exclusiveMinimum: 0 }),
    sessionAmount: Type.Number({ exclusiveMinimum: 0 }),
    initialProgress: Type.Number({ minimum: 0 }),
    timezone: Type.String({ minLength: 1 }),
  },
  strict,
);
export type GoalCreate = Static<typeof GoalCreate>;

export const GoalParams = Type.Object({ goalId: Type.String({ format: 'uuid' }) }, strict);
export const LogParams = Type.Object(
  { goalId: Type.String({ format: 'uuid' }), localDate: Type.String({ format: 'date' }) },
  strict,
);

// DONE requires amount, SKIPPED must not carry amount (status-specific contract).
export const LogPut = Type.Union([
  Type.Object({ status: Type.Literal('DONE'), amount: Type.Number({ exclusiveMinimum: 0 }) }, strict),
  Type.Object({ status: Type.Literal('SKIPPED') }, strict),
]);
export type LogPut = Static<typeof LogPut>;

export const Log = Type.Object(
  {
    localDate: Type.String(),
    status: Type.Union([Type.Literal('DONE'), Type.Literal('SKIPPED')]),
    amount: Type.Union([Type.Number(), Type.Null()]),
  },
  strict,
);
export type Log = Static<typeof Log>;

export const Today = Type.Object(
  {
    today: Type.String(),
    yesterday: Type.String(),
    todayLog: Type.Union([Log, Type.Null()]),
    yesterdayMissing: Type.Boolean(),
    // Neither variant is the Product DTO. The first is the placeholder; the second is a
    // load-observation summary of the real engine (packages/prediction), not its PredictionResult.
    prediction: Type.Union([
      Type.Object(
        {
          placeholder: Type.Literal(true),
          observedDays: Type.Number(),
          computeMode: Type.String(),
          requestedBurnMs: Type.Number(),
        },
        strict,
      ),
      Type.Object(
        {
          placeholder: Type.Literal(false),
          observedDays: Type.Number(),
          computeMode: Type.String(),
          modelVersion: Type.String(),
          completionStatus: Type.String(),
          coreMetricStatus: Type.String(),
          requiredFutureDone: Type.Number(),
          entryPoint: Type.String(),
          computeMs: Type.Number(),
        },
        strict,
      ),
    ]),
  },
  strict,
);
export type Today = Static<typeof Today>;
