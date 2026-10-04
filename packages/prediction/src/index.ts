export { DEFAULT_CONFIG } from './config.js';
export { predict } from './predict.js';
// Public Engine classifications supply no HTTP/DB conversion.
export { PredictionInputError, PredictionConfigError } from './errors.js';
export type { LocalDate, PredictionInput, TransitionCounts, Posterior, CoreMetric,
  Completion, PredictionConfig, PredictionCalculation, PredictionResult } from './types.js';
