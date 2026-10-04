import { predict, PredictionInputError, PredictionConfigError } from '../src/index.js';
import type { CoreMetric, LocalDate, PredictionInput, Completion, PredictionCalculation, PredictionResult } from '../src/index.js';

const callerDate: LocalDate = '2026-10-03';
const input: PredictionInput = {
  goal: { totalRequired: 20, initialProgress: 2, sessionAmount: 10 },
  logs: [{ localDate: callerDate, status: 'SKIPPED', amount: null }],
  today: callerDate,
};
void input;

function waitingDays(metric: CoreMetric): number | undefined {
  switch (metric.status) {
    case 'available': return metric.g50;
    case 'insufficient':
    case 'not_applicable': return undefined;
  }
}
void waitingDays;

// @ts-expect-error An unavailable metric must not carry a numeric delay.
const unavailableWithDelay: CoreMetric = { status: 'insufficient', reason: 'NO_SKIP_ORIGIN_TRANSITION', g50: 0 };
// @ts-expect-error UNKNOWN is a missing calendar slot, not a stored ActionLog status.
const unknownLog: PredictionInput['logs'][number] = { localDate: callerDate, status: 'UNKNOWN', amount: null };
// @ts-expect-error The reason must agree with its discriminant.
const wrongReason: CoreMetric = { status: 'not_applicable', reason: 'NO_SKIP_ORIGIN_TRANSITION' };
void unavailableWithDelay;
void unknownLog;
void wrongReason;

const partialHorizon: Completion = { status: 'available', scenario: 'CURRENT_STATE', p50Days: 1, p80Days: null };
// @ts-expect-error Horizon tails are null, never a textual sentinel.
const badTail: Completion = { status: 'available', scenario: 'TODAY_DONE', p50Days: 'unreachable', p80Days: null };
// @ts-expect-error Completed results do not carry an available-day estimate.
const completedWithDays: Completion = { status: 'completed', p50Days: 0 };
function pendingMetadata(result: PredictionCalculation): void {
  // @ts-expect-error The calculation-only shape lacks mandatory Result metadata.
  void result.observations.observedDays;
  // @ts-expect-error Internal calculations lack the two adopted mandatory metadata fields.
  const incomplete: PredictionResult = result;
  // An incomplete numerical shape cannot masquerade as the complete Result.
  const complete: PredictionResult = { ...result,
    observations: { ...result.observations, observedDays: 1, recordedDays: 1 } };
  void incomplete;
  void complete;
}
void partialHorizon;
void badTail;
void completedWithDays;
void pendingMetadata;

const publicResult: PredictionResult = predict(input);
const publicCalendarDays: number = publicResult.observations.observedDays;
const publicRecordedDays: number = publicResult.observations.recordedDays;
function classifiedError(error: unknown): readonly (string | number)[] | undefined {
  if (error instanceof PredictionInputError || error instanceof PredictionConfigError) {
    // @ts-expect-error Paths are immutable to consumers.
    error.path.push('changed');
    return error.path;
  }
  return undefined;
}
void publicCalendarDays;
void publicRecordedDays;
void classifiedError;
