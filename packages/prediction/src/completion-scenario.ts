import { mixtureCompletionQuantiles } from './completion.js';
import { samplePosterior } from './random.js';
import type { Completion, Posterior, PredictionConfig, PredictionInput, PredictionResult } from './types.js';

// 入力・config・posteriorは呼び出し側で検証済み、かつ完了の材料ありの場合にだけ使う。
// legacyと候補で今日の実量／仮実行の扱いがずれないよう、日数計算を一か所へ置く。
export function completionFromValidatedState(goal: PredictionInput['goal'], actualDone: number,
  todayStatus: PredictionResult['todayStatus'], posterior: Posterior,
  config: Pick<PredictionConfig, 'samples' | 'horizonDays' | 'seed'>): Extract<Completion, { status: 'available' }> {
  const scenario = todayStatus === 'UNRECORDED' ? 'TODAY_DONE' : 'CURRENT_STATE';
  // 今日DONEの実量はactualDoneに一度だけ含む。仮sessionは未記録のときだけ引く。
  const remaining = goal.totalRequired - actualDone - (todayStatus === 'UNRECORDED' ? goal.sessionAmount : 0);
  const amount = BigInt(goal.sessionAmount);
  const requiredFutureDone = remaining <= 0 ? 0 : Number((BigInt(remaining) + amount - 1n) / amount);
  const quantiles = requiredFutureDone === 0 ? { p50Days: 0, p80Days: 0 }
    : requiredFutureDone > config.horizonDays ? { p50Days: null, p80Days: null }
      : mixtureCompletionQuantiles(samplePosterior(posterior, config.samples, config.seed),
        todayStatus === 'SKIPPED' ? 'SKIPPED' : 'DONE', requiredFutureDone, config.horizonDays);
  return { status: 'available', scenario, ...quantiles };
}
