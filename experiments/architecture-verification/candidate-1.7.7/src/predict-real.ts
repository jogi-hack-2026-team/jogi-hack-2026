// Supporting Artifact / Not a Source of Truth (Issue #84).
// Calls the real Prediction Engine (packages/prediction) that was merged to main after the
// placeholder runs. The compiled output is loaded at runtime because the package uses `.js`
// import specifiers; build it first (see the candidate README). Nothing here adopts an HTTP
// contract for the engine: the summary below exists only to observe the service under load.
import { performance } from 'node:perf_hooks';
import type { PredictionInput, PredictionResult } from '../../../../packages/prediction/src/index.ts';

export type RealInput = PredictionInput;
export type RealSummary = {
  modelVersion: string;
  completionStatus: string;
  coreMetricStatus: string;
  remainingAmount: number;
  computeMs: number;
};

const engineUrl = new URL('../../../../packages/prediction/dist/src/index.js', import.meta.url);
const { predict } = (await import(engineUrl.href)) as { predict: (input: PredictionInput) => PredictionResult };

export function runReal(input: RealInput): RealSummary {
  const t0 = performance.now();
  const r = predict(input);
  const computeMs = performance.now() - t0;
  return {
    modelVersion: r.modelVersion,
    completionStatus: r.completion.status,
    coreMetricStatus: r.coreMetric.status,
    remainingAmount: r.progress.total - r.progress.done,
    computeMs,
  };
}
