import assert from 'node:assert/strict';
import test from 'node:test';
import { recoveryQuantiles } from '../dist/src/recovery.js';
import { beta, seedFor, splitmix32, uniform } from '../dist/src/random.js';

function factorial(n) {
  let result = 1n;
  for (let i = 2n; i <= BigInt(n); i++) result *= i;
  return result;
}

// Independent integer Beta-function formula, rather than the production recurrence.
function oracle(alpha, beta) {
  const result = {};
  for (let t = 1; !result.g80; t++) {
    const n = factorial(beta + t - 1) * factorial(alpha + beta - 1);
    const d = factorial(beta - 1) * factorial(alpha + beta + t - 1);
    if (!result.g50 && 2n * n <= d) result.g50 = t;
    if (5n * n <= d) result.g80 = t;
  }
  return result;
}

test('T-02 exact inclusive median and 80% boundaries and fixture', () => {
  assert.equal(recoveryQuantiles(5, 9).g50, 2);
  assert.equal(recoveryQuantiles(5, 5).g50, 1);
  assert.deepEqual(recoveryQuantiles(2, 2), { g50: 1, g80: 3 });
  assert.deepEqual(recoveryQuantiles(8, 2), { g50: 1, g80: 1 });
  assert.deepEqual(recoveryQuantiles(1, 1), { g50: 1, g80: 4 });
});

test('T-02 factorial oracle covers normalization and minimal quantiles', () => {
  for (let alpha = 1; alpha <= 12; alpha++) {
    for (let beta = 1; beta <= 16; beta++) {
      const actual = recoveryQuantiles(alpha, beta);
      assert.deepEqual(actual, oracle(alpha, beta), `alpha=${alpha}, beta=${beta}`);
      assert.ok(actual.g50 >= 1 && actual.g80 >= actual.g50);
      // The summed PMF telescopes to 1 minus this independently computed tail.
      let mass = 0;
      const survival = t => Number(factorial(beta + t - 1) * factorial(alpha + beta - 1)) /
        Number(factorial(beta - 1) * factorial(alpha + beta + t - 1));
      for (let t = 1; t <= 50; t++) mass += survival(t - 1) - survival(t);
      assert.ok(Math.abs(mass + survival(50) - 1) < 1e-12);
    }
  }
});

test('T-03 added resumptions cannot delay and added skips cannot accelerate recovery', () => {
  for (let alpha = 2; alpha <= 20; alpha++) {
    for (let beta = 2; beta <= 40; beta++) {
      const baseline = recoveryQuantiles(alpha, beta);
      const resumed = recoveryQuantiles(alpha + 1, beta);
      const skipped = recoveryQuantiles(alpha, beta + 1);
      for (const key of ['g50', 'g80']) {
        assert.ok(resumed[key] <= baseline[key]);
        assert.ok(skipped[key] >= baseline[key]);
      }
    }
  }
});

test('T-15 alpha=2 closed survival oracle handles many skips beyond completion horizon', () => {
  for (const beta of [2, 9, 100, 2000, 10000]) {
    const actual = recoveryQuantiles(2, beta);
    const n = BigInt(beta) * (BigInt(beta) + 1n);
    for (const [key, multiplier] of [['g50', 2n], ['g80', 5n]]) {
      const t = BigInt(actual[key]);
      const b = BigInt(beta);
      assert.ok(multiplier * n <= (b + t) * (b + t + 1n));
      assert.ok(multiplier * n > (b + t - 1n) * (b + t));
    }
  }
  assert.ok(recoveryQuantiles(2, 10000).g80 > 1095);
});

test('T-15 safe shapes retain exact arithmetic when their sum is unsafe', () => {
  const max = Number.MAX_SAFE_INTEGER;
  assert.equal(recoveryQuantiles(max, max).g50, 1);
  assert.equal(recoveryQuantiles(max - 1, max).g50, 2);
  assert.deepEqual(recoveryQuantiles(max, 2), { g50: 1, g80: 1 });
  // A floating ratio rounds a survival strictly above the median boundary to 0.5.
  assert.equal((max - 1) / ((max - 2) + (max - 1)), 0.5);
  assert.equal(recoveryQuantiles(max - 2, max - 1).g50, 2);
});

test('invalid shapes are rejected instead of entering the survival calculation', () => {
  for (const invalid of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => recoveryQuantiles(invalid, 2), RangeError);
    assert.throws(() => recoveryQuantiles(2, invalid), RangeError);
  }
});

test('T-05 posterior Beta then Geometric Monte Carlo supports exact quantiles', () => {
  const count = 100000;
  for (const [index, [alpha, betaShape]] of [[5, 9], [2, 8], [8, 2], [3, 20]].entries()) {
    const next = splitmix32(seedFor(20261012, index));
    const samples = Array.from({ length: count }, () => {
      const p = beta(alpha, betaShape, next);
      return Math.floor(Math.log(uniform(next)) / Math.log1p(-p)) + 1;
    }).sort((a, b) => a - b);
    const exact = recoveryQuantiles(alpha, betaShape);
    for (const [key, probability] of [['g50', 0.5], ['g80', 0.8]]) {
      // Discrete exact-threshold fixtures can straddle adjacent days under sampling noise.
      const empirical = samples[Math.ceil(probability * count) - 1];
      assert.ok(Math.abs(empirical - exact[key]) <= 1, `${alpha},${betaShape}: ${key}`);
      const below = samples.filter(t => t < exact[key]).length / count;
      const through = samples.filter(t => t <= exact[key]).length / count;
      // 0.008 is over five worst-case binomial standard errors at N=100000.
      assert.ok(below <= probability + 0.008);
      assert.ok(through >= probability - 0.008);
    }
  }
});
