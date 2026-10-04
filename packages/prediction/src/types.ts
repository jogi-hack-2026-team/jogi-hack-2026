// Calculation contracts from Architecture; transport validation is separate.
// The caller supplies YYYY-MM-DD in the Goal timezone; the Engine never reads a clock.
export type LocalDate = string;

export interface PredictionInput {
  goal: { totalRequired: number; initialProgress: number; sessionAmount: number };
  // Quantities use the Goal's unit; DONE uses the actual recorded amount, not sessionAmount.
  logs: { localDate: LocalDate; status: 'DONE' | 'SKIPPED'; amount: number | null }[];
  today: LocalDate;
}

export interface TransitionCounts {
  nDD: number;
  nDS: number;
  nSD: number;
  nSS: number;
}

export interface Posterior {
  a: { alpha: number; beta: number };
  b: { alpha: number; beta: number };
}

// Discriminants keep an unavailable value distinct from a measured zero-day delay.
// g50/g80 are integer waiting days, compared exactly with BigInt.
export type CoreMetric =
  | { status: 'available'; g50: number; g80: number }
  | { status: 'insufficient'; reason: 'NO_SKIP_ORIGIN_TRANSITION' }
  | { status: 'not_applicable'; reason: 'TODAY_RECORDED' | 'COMPLETED' };

export interface PredictionConfig {
  modelVersion: string;
  prior: number;
  samples: number;
  horizonDays: number;
  seed: number;
}

export type Completion =
  | { status: 'available'; scenario: 'TODAY_DONE' | 'CURRENT_STATE';
      p50Days: number | null; p80Days: number | null }
  | { status: 'insufficient'; reason: 'NO_DONE_ORIGIN_TRANSITION' | 'NO_SKIP_ORIGIN_TRANSITION' }
  | { status: 'completed' };

// Calculation-only shape retained for numerical components and incomplete-result type checks.
export interface PredictionCalculation {
  modelVersion: string;
  today: LocalDate;
  todayStatus: 'DONE' | 'SKIPPED' | 'UNRECORDED';
  progress: { done: number; total: number; completed: boolean };
  observations: TransitionCounts & { effectiveTransitions: number };
  posterior: Posterior;
  coreMetric: CoreMetric;
  completion: Completion;
  config: Omit<PredictionConfig, 'modelVersion'>;
}

// Adopted metadata describes the existing observation window:
// observedDays counts step1's calendar slots (UNKNOWN included); recordedDays counts stored logs.
// An empty history has neither an observation origin nor recorded logs, so both values are zero.
export interface PredictionResult extends Omit<PredictionCalculation, 'observations'> {
  observations: PredictionCalculation['observations'] & { observedDays: number; recordedDays: number };
}
