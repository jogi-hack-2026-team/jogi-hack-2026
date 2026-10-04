// Architecture: Prediction Engine interface, D-19–D-22. No runtime/tool version decision.
export const DEFAULT_CONFIG = Object.freeze({
  modelVersion: 'behavior-persistence-m1-v1',
  prior: 2,
  samples: 200,
  horizonDays: 1095,
  seed: 20261012,
} as const);
