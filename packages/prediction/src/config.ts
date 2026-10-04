// ArchitectureのPrediction Engine契約・D-19〜D-22に従う。runtimeやツールの版を採択する設定ではない。
export const DEFAULT_CONFIG = Object.freeze({
  modelVersion: 'behavior-persistence-m1-v1',
  prior: 2,
  samples: 200,
  horizonDays: 1095,
  seed: 20261012,
} as const);
