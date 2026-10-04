import { DEFAULT_CONFIG } from './config.js';
import { observe } from './observations.js';
import { recoveryQuantiles } from './recovery.js';
import { samplePosterior } from './random.js';
import { mixtureCompletionQuantiles } from './completion.js';
import { PredictionConfigError } from './errors.js';
import type { Completion, CoreMetric, PredictionResult, PredictionConfig, PredictionInput } from './types.js';

function validateConfig(config: PredictionConfig): void {
  for (const field of ['prior', 'samples', 'horizonDays'] as const) {
    if (!Number.isSafeInteger(config[field]) || config[field] < 1) {
      throw new PredictionConfigError('INVALID_INTEGER', [field], `${field} must be a positive safe integer`);
    }
  }
  if (!Number.isInteger(config.seed) || config.seed < 0 || config.seed > 0xffffffff) {
    throw new PredictionConfigError('INVALID_SEED', ['seed'], 'seed must be uint32');
  }
  // Changing a label alone must not claim a different model implementation.
  if (config.modelVersion !== DEFAULT_CONFIG.modelVersion) {
    throw new PredictionConfigError('UNSUPPORTED_MODEL', ['modelVersion'], 'Unsupported modelVersion');
  }
}

export function predict(input: PredictionInput, config: PredictionConfig = DEFAULT_CONFIG): PredictionResult {
  validateConfig(config);
  const { counts, actualDone, todayStatus, observationWindow, recordedLogCount } = observe(input);
  const posterior = {
    a: { alpha: config.prior + counts.nDD, beta: config.prior + counts.nDS },
    b: { alpha: config.prior + counts.nSD, beta: config.prior + counts.nSS },
  };
  for (const parameter of ['a', 'b'] as const) {
    for (const shape of ['alpha', 'beta'] as const) {
      if (!Number.isSafeInteger(posterior[parameter][shape])) {
        throw new PredictionConfigError('UNSAFE_POSTERIOR', ['posterior', parameter, shape],
          'prior + transition count exceeds exact integer range for posterior shape');
      }
    }
  }
  const completed = actualDone >= input.goal.totalRequired;
  let coreMetric: CoreMetric;
  let completion: Completion;
  if (completed) {
    coreMetric = { status: 'not_applicable', reason: 'COMPLETED' };
    completion = { status: 'completed' };
  } else {
    if (todayStatus !== 'UNRECORDED') {
      coreMetric = { status: 'not_applicable', reason: 'TODAY_RECORDED' };
    } else if (counts.nSD + counts.nSS === 0) {
      coreMetric = { status: 'insufficient', reason: 'NO_SKIP_ORIGIN_TRANSITION' };
    } else {
      coreMetric = { status: 'available', ...recoveryQuantiles(posterior.b.alpha, posterior.b.beta) };
    }

    if (counts.nDD + counts.nDS === 0) {
      completion = { status: 'insufficient', reason: 'NO_DONE_ORIGIN_TRANSITION' };
    } else if (counts.nSD + counts.nSS === 0) {
      completion = { status: 'insufficient', reason: 'NO_SKIP_ORIGIN_TRANSITION' };
    } else {
      const scenario = todayStatus === 'UNRECORDED' ? 'TODAY_DONE' : 'CURRENT_STATE';
      // Recorded today amounts are already in actualDone. Count only future DONEs in DP.
      const remaining = input.goal.totalRequired - actualDone -
        (todayStatus === 'UNRECORDED' ? input.goal.sessionAmount : 0);
      let quantiles: { p50Days: number | null; p80Days: number | null };
      if (remaining <= 0) quantiles = { p50Days: 0, p80Days: 0 };
      else {
        // Keep the integer session count explicit through the division.
        const amount = BigInt(input.goal.sessionAmount);
        const requiredFutureDone = Number((BigInt(remaining) + amount - 1n) / amount);
        quantiles = requiredFutureDone > config.horizonDays
          ? { p50Days: null, p80Days: null }
          : mixtureCompletionQuantiles(samplePosterior(posterior, config.samples, config.seed),
            todayStatus === 'SKIPPED' ? 'SKIPPED' : 'DONE', requiredFutureDone, config.horizonDays);
      }
      completion = { status: 'available', scenario, ...quantiles };
    }
  }
  return {
    modelVersion: config.modelVersion, today: input.today, todayStatus,
    progress: { done: actualDone, total: input.goal.totalRequired, completed },
    // Describe step1's actual window without changing transition eligibility.
    // Only an empty history has no observation origin and therefore zero calendar slots.
    observations: { ...counts, effectiveTransitions: counts.nDD + counts.nDS + counts.nSD + counts.nSS,
      observedDays: observationWindow?.calendarSlots ?? 0, recordedDays: recordedLogCount },
    posterior, coreMetric, completion,
    config: { prior: config.prior, samples: config.samples, horizonDays: config.horizonDays, seed: config.seed },
  };
}
