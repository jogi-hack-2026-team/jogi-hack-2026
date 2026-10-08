// Supporting Artifact / Not a Source of Truth (Issue #84).
// Calls the real Prediction Engine (packages/prediction) that was merged to main after the
// placeholder runs. The compiled output is loaded at runtime because the package uses `.js`
// import specifiers; build it first (see the candidate README). Nothing here adopts an HTTP
// contract for the engine: the summary below exists only to observe the service under load.
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PredictionInput, PredictionResult } from '../../../../packages/prediction/src/index.ts';

export type QuestionPrior = {
  answers: { a: 'LOW' | 'MID' | 'HIGH' | 'UNKNOWN' | null; b: 'LOW' | 'MID' | 'HIGH' | 'UNKNOWN' | null };
  mapping: { version: string; values: Record<'LOW' | 'MID' | 'HIGH', { alpha: number; beta: number }> };
};
export type RealInput = PredictionInput & { questionPrior?: QuestionPrior };
export type RealSummary = {
  modelVersion: string;
  completionStatus: string;
  coreMetricStatus: string;
  remainingAmount: number;
  requiredFutureDone: number;
  entryPoint: 'predict' | 'predictWithQuestionPrior';
  computeMs: number;
};

export const engineUrl = process.env.SPIKE_ENGINE_ROOT
  ? pathToFileURL(resolve(process.env.SPIKE_ENGINE_ROOT, 'dist/src/index.js'))
  : new URL('../../../../packages/prediction/dist/src/index.js', import.meta.url);
const engine = (await import(engineUrl.href)) as {
  predict: (input: PredictionInput) => PredictionResult;
  predictWithQuestionPrior?: (input: { prediction: PredictionInput } & QuestionPrior) => { prediction: PredictionResult };
};

export class RealInputValidationError extends TypeError {
  constructor() { super('Real engine quantities must be safe integers; accumulated progress must remain safe.'); this.name = 'RealInputValidationError'; }
}
export function realQuantity(value: string | number, minimum: number): number {
  // Keep numeric DB text exact until its range/integrality has been checked.
  if (typeof value === 'string') {
    if (!/^\d+(?:\.0+)?$/.test(value)) throw new RealInputValidationError();
    const integer = BigInt(value.split('.')[0]!);
    if (integer < BigInt(minimum) || integer > BigInt(Number.MAX_SAFE_INTEGER)) throw new RealInputValidationError();
    return Number(integer);
  }
  if (!Number.isSafeInteger(value) || value < minimum) throw new RealInputValidationError();
  return value;
}
export function validateRealGoal(goal: PredictionInput['goal']) {
  for (const [key, minimum] of [['totalRequired', 1], ['sessionAmount', 1], ['initialProgress', 0]] as const) {
    if (!Number.isSafeInteger(goal[key]) || goal[key] < minimum) throw new RealInputValidationError();
  }
}
export function validateRealInput(input: PredictionInput) {
  validateRealGoal(input.goal);
  let done = input.goal.initialProgress;
  for (const log of input.logs) if (log.status === 'DONE') {
    if (!Number.isSafeInteger(log.amount) || log.amount! < 1) throw new RealInputValidationError();
    done += log.amount!;
    if (!Number.isSafeInteger(done)) throw new RealInputValidationError();
  }
}

export function runReal(input: RealInput): RealSummary {
  validateRealInput(input);
  const { questionPrior, ...prediction } = input;
  const t0 = performance.now();
  const entryPoint = questionPrior ? 'predictWithQuestionPrior' : 'predict';
  if (questionPrior && !engine.predictWithQuestionPrior) throw new Error('Selected engine has no public question-prior entry');
  const r = questionPrior
    ? engine.predictWithQuestionPrior!({ prediction, ...questionPrior }).prediction
    : engine.predict(prediction);
  const computeMs = performance.now() - t0;
  // Actual today DONE is already in progress.done. Only UNRECORDED uses one virtual session.
  const remainingAmount = Math.max(0, r.progress.total - r.progress.done -
    (r.todayStatus === 'UNRECORDED' ? input.goal.sessionAmount : 0));
  const amount = BigInt(input.goal.sessionAmount);
  return {
    modelVersion: r.modelVersion,
    completionStatus: r.completion.status,
    coreMetricStatus: r.coreMetric.status,
    remainingAmount,
    requiredFutureDone: Number((BigInt(remainingAmount) + amount - 1n) / amount),
    entryPoint,
    computeMs,
  };
}
