import assert from 'node:assert/strict';
import test from 'node:test';
import { predict, predictWithQuestionPrior, DEFAULT_CONFIG, PredictionConfigError } from '../dist/src/index.js';
import { integratedCompletionCdf, completionQuantiles, exactIntegratedReached } from '../dist/src/completion-integrated.js';
import { recoveryQuantiles } from '../dist/src/recovery.js';

// Beta-binomial recurrenceとは別の全Markov経路と独立Beta整数moments。
// 小さいhorizonだけに限定し、閾値・開始状態・巨大shapeをBigIntで照合する。
function moment(alpha, beta, successes, failures) {
  let numerator = 1n, denominator = 1n;
  for (let i = 0; i < successes; i++) numerator *= BigInt(alpha) + BigInt(i);
  for (let i = 0; i < failures; i++) numerator *= BigInt(beta) + BigInt(i);
  for (let i = 0; i < successes + failures; i++) denominator *= BigInt(alpha) + BigInt(beta) + BigInt(i);
  return Number(numerator) / Number(denominator);
}
function pathOracle(posterior, state, N, H) {
  let cdf = 0;
  function visit(day, previous, done, dd, ds, sd, ss) {
    if (day === H) {
      if (done >= N) cdf += moment(posterior.a.alpha, posterior.a.beta, dd, ds) *
        moment(posterior.b.alpha, posterior.b.beta, sd, ss);
      return;
    }
    visit(day + 1, 'DONE', done + 1, dd + Number(previous === 'DONE'), ds,
      sd + Number(previous === 'SKIPPED'), ss);
    visit(day + 1, 'SKIPPED', done, dd, ds + Number(previous === 'DONE'), sd,
      ss + Number(previous === 'SKIPPED'));
  }
  visit(0, state, 0, 0, 0, 0, 0);
  return cdf;
}
const posterior = { a: { alpha: 2, beta: 5 }, b: { alpha: 3, beta: 7 } };
const config = { ...DEFAULT_CONFIG, horizonDays: 9 };

test('integrated CDF: independent full paths cover both states, integer shapes and concentrated/skewed extremes', () => {
  for (const [aa, ab, ba, bb] of [[2,5,3,7], [1,1,1,1], [1,1e6,1e6,1], [1e6,1,1,1e6],
    [1e6,1e6,1e6,1e6], [3,999999,999999,3]]) {
    const p = { a: { alpha: aa, beta: ab }, b: { alpha: ba, beta: bb } };
    for (const state of ['DONE', 'SKIPPED']) for (const N of [1,2,4,9]) {
      const cdf = integratedCompletionCdf(p, state, N, 9);
      let previous = 0;
      for (let day = 0; day <= 9; day++) {
        const actual = cdf(day), expected = pathOracle(p, state, N, day);
        assert.ok(Math.abs(actual - expected) < 1e-10, `${aa},${ab},${ba},${bb}/${state}/${N}/${day}`);
        assert.ok(actual >= previous - 1e-10 && actual >= -1e-10 && actual <= 1 + 1e-10);
        previous = actual;
      }
    }
  }
});

test('auto: actual metadata and days are independent of requested samples/seed; R11 takes the same available branch', () => {
  const input = { goal: { totalRequired: 20, initialProgress: 0, sessionAmount: 3 }, today: '2026-10-05', logs: [
    { localDate: '2026-10-01', status: 'DONE', amount: 1 },
    { localDate: '2026-10-02', status: 'SKIPPED', amount: null },
    { localDate: '2026-10-03', status: 'SKIPPED', amount: null },
    { localDate: '2026-10-04', status: 'DONE', amount: 2 },
  ] };
  const expected = predict(input, config);
  assert.deepEqual(expected.completion.computation,
    { method: 'BETA_BINOMIAL', samples: null, seed: null, fallbackReason: null });
  for (const samples of [1,200,Number.MAX_SAFE_INTEGER]) for (const seed of [0,1,0xffffffff]) {
    const result = predict(input, { ...config, samples, seed });
    assert.deepEqual(result.completion, expected.completion);
    assert.deepEqual(result.coreMetric, expected.coreMetric);
    assert.equal(result.config.samples, samples); assert.equal(result.config.seed, seed);
  }
  const mapping = { version: 'synthetic-v1', values: {
    LOW: { alpha: 1, beta: 3 }, MID: { alpha: 2, beta: 2 }, HIGH: { alpha: 3, beta: 1 } } };
  const r11 = predictWithQuestionPrior({ prediction: { ...input, logs: [] },
    answers: { a: 'HIGH', b: 'HIGH' }, mapping }, config);
  assert.equal(r11.prediction.completion.status, 'available');
  assert.ok(r11.prediction.completion.computation);
  assert.equal(r11.plan, null);
});

test('explicit sampled and domain fallbacks expose actual draws; threshold ties use bounded exact comparisons', () => {
  const sampled = completionQuantiles(posterior, 'DONE', 2, { ...config, completionMethod: 'sampled' });
  assert.deepEqual(sampled.computation, { method: 'POSTERIOR_SAMPLING', samples: 200, seed: 20261012, fallbackReason: null });
  const threshold = completionQuantiles({ a: { alpha: 2, beta: 2 }, b: { alpha: 2, beta: 2 } }, 'DONE', 1, { ...config, horizonDays: 1 });
  assert.deepEqual([threshold.p50Days, threshold.p80Days, threshold.computation.method], [1,null,'BETA_BINOMIAL']);
  assert.equal(threshold.computation.samples, null);
  assert.equal(exactIntegratedReached({ a: { alpha: 2, beta: 2 }, b: { alpha: 2, beta: 2 } }, 'DONE', 1, 1, .5), true);
  assert.equal(exactIntegratedReached({ a: { alpha: 2, beta: 2 }, b: { alpha: 2, beta: 2 } }, 'DONE', 1, 1, .8), false);
  const symmetric = completionQuantiles({ a: { alpha: 1, beta: 1 }, b: { alpha: 1, beta: 1 } }, 'DONE', 548,
    { ...config, samples: 1, horizonDays: 1095 });
  assert.deepEqual([symmetric.p50Days, symmetric.p80Days, symmetric.computation.method], [1095,null,'BETA_BINOMIAL']);
  assert.throws(() => exactIntegratedReached({ a: { alpha: .5, beta: 1 }, b: { alpha: 1, beta: 1 } }, 'DONE', 1, 0, .5), RangeError);
  const horizon = completionQuantiles(posterior, 'DONE', 1, { ...config, horizonDays: 1096 });
  assert.equal(horizon.computation.fallbackReason, 'HORIZON_OUT_OF_RANGE');
  const shape = completionQuantiles({ ...posterior, a: { alpha: 1_000_001, beta: 2 } }, 'DONE', 1, config);
  assert.equal(shape.computation.fallbackReason, 'SHAPE_OUT_OF_RANGE');
  for (const result of [horizon,shape]) assert.deepEqual(
    [result.computation.method,result.computation.samples,result.computation.seed], ['POSTERIOR_SAMPLING',200,20261012]);
});
