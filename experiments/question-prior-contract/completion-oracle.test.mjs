import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { closedCompletionCdf, replayGoldens } from './verify-completion.mjs';
import { mixtureCompletionQuantiles } from '../../packages/prediction/dist/src/completion.js';

test('independent conditional CDF matches exact path weights for both states and 0/1 probabilities', () => {
  for (const initial of ['DONE', 'SKIPPED']) for (const aq of [0, 1, 2, 3, 4]) for (const bq of [0, 1, 2, 3, 4]) {
    for (let h = 1; h <= 5; h++) for (let n = 1; n <= h + 1; n++) {
      let reachedWeight = 0n;
      for (let bits = 0; bits < 2 ** h; bits++) {
        let state = initial, count = 0, weight = 1n;
        for (let day = 0; day < h; day++) {
          const probability = state === 'DONE' ? aq : bq;
          const done = (bits & (1 << day)) !== 0;
          weight *= BigInt(done ? probability : 4 - probability);
          if (done) count++;
          state = done ? 'DONE' : 'SKIPPED';
        }
        if (count >= n) reachedWeight += weight;
      }
      assert.ok(Math.abs(closedCompletionCdf(aq / 4, bq / 4, initial, n, h) - Number(reachedWeight) / 4 ** h) < 1e-12);
    }
  }
});

test('nine frozen completion-day goldens match the shared sampler/DP and independent conditional CDF', () => {
  const replay = replayGoldens();
  assert.equal(replay.nontrivialCases, 9);
  assert.ok(replay.maxCdfError < 1e-11);
});

test('zero/horizon cases remain separate from nine nontrivial goldens and reported integration gaps remain explicit', () => {
  const fixture = JSON.parse(readFileSync(new URL('./common-fixtures.json', import.meta.url), 'utf8'));
  for (const id of ['F17', 'F18']) {
    const c = fixture.calculationExamples.find(c => c.id === id);
    assert.deepEqual(mixtureCompletionQuantiles([], 'DONE', c.expected.completion.requiredFutureDone, c.config.horizonDays),
      { p50Days: c.expected.completion.p50Days, p80Days: c.expected.completion.p80Days });
  }
  const evidence = JSON.parse(readFileSync(new URL('./completion-goldens.json', import.meta.url), 'utf8'));
  assert.equal(evidence.gateDifferenceIds.length, 13);
  assert.equal(evidence.priorErrorDifference.actual, 'RangeError');
  assert.equal(evidence.integrationSpecificationsNotExecuted, 10);
});
