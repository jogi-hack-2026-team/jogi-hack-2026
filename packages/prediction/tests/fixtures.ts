import type { PredictionInput, TransitionCounts, CoreMetric } from '../src/index.js';

// Fixed references, not a second source of truth. See README for provenance.
export const recoveryExamples = [
  { name: 'three resumptions in ten skip-origin transitions', alpha: 5, beta: 9, g50: 2 },
  { name: 'inclusive 50 percent boundary', alpha: 5, beta: 5, g50: 1 },
  { name: 'prior boundaries', alpha: 2, beta: 2, g50: 1, g80: 3 },
] as const;

// Calendar slots are explicit: missing 10-08 must break both adjacent pairs.
export const unknownGapInput: PredictionInput = {
  goal: { totalRequired: 100, initialProgress: 20, sessionAmount: 10 },
  today: '2026-10-10',
  logs: [
    { localDate: '2026-10-03', status: 'DONE', amount: 10 },
    { localDate: '2026-10-04', status: 'DONE', amount: 10 },
    { localDate: '2026-10-05', status: 'SKIPPED', amount: null },
    { localDate: '2026-10-06', status: 'SKIPPED', amount: null },
    { localDate: '2026-10-07', status: 'DONE', amount: 10 },
    { localDate: '2026-10-09', status: 'DONE', amount: 10 },
  ],
};
export const unknownGapExpected: TransitionCounts = { nDD: 1, nDS: 1, nSD: 1, nSS: 1 };

// Same Goal unit. Today's 3 is already in actualDone=7; adding sessionAmount again gives 17.
// Both origin states have a transition. CURRENT_STATE starts at futureDoneCount=0.
export const todayDoneInput: PredictionInput = {
  goal: { totalRequired: 20, initialProgress: 2, sessionAmount: 10 },
  today: '2026-10-03',
  logs: [
    { localDate: '2026-10-01', status: 'DONE', amount: 2 },
    { localDate: '2026-10-02', status: 'SKIPPED', amount: null },
    { localDate: '2026-10-03', status: 'DONE', amount: 3 },
  ],
};
export const todayDoneExpected = {
  actualDone: 7, projectedDone: 7, requiredFutureDone: 2, futureDoneCount: 0,
  coreMetric: { status: 'not_applicable', reason: 'TODAY_RECORDED' } satisfies CoreMetric,
} as const;

// Architecture T-10 / PR86 regression shared by #72 and #73 tests.
export const dpBoundaryExample = {
  initialState: 'DONE', requiredFutureDone: 1, horizonDays: 10,
  samples: [{ a: 0.9999999995, b: 0.5 }, { a: 1e-10, b: 1e-10 }],
  expectedP50Days: 3, quantileEpsilon: 1e-12,
} as const;
