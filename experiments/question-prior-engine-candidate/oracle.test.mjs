import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { closedCompletionCdf, verifyFixtureSet } from './verify.mjs';
import { evaluateQuestionPriorAdapterCandidate } from '../../packages/prediction/dist/src/question-prior-adapter-candidate.js';

test('independent renewal CDF matches exact integer enumeration for both initial states and degenerate probabilities', () => {
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

test('proposal adapter keeps UNKNOWN/null separate from MID and rejects unrecognized raw values', () => {
  const fixture = JSON.parse(readFileSync(new URL('../../packages/prediction/tests/fixtures-pr118.json', import.meta.url), 'utf8'));
  const request = { prediction: fixture.calculationExamples[0].input, mapping: fixture.mappingCandidate };
  const empty = evaluateQuestionPriorAdapterCandidate({ ...request, answers: { a: null, b: 'UNKNOWN' } });
  const mid = evaluateQuestionPriorAdapterCandidate({ ...request, answers: { a: 'MID', b: 'MID' } });
  assert.deepEqual(empty.eligible, { a: false, b: false });
  assert.deepEqual(mid.eligible, { a: true, b: true });
  assert.equal(empty.priorSnapshot.a.alpha, mid.priorSnapshot.a.alpha);
  assert.notEqual(empty.priorSnapshot.a.source, mid.priorSnapshot.a.source);
  assert.throws(() => evaluateQuestionPriorAdapterCandidate({ ...request, answers: { a: 'CERTAIN', b: 'MID' } }), TypeError);
  assert.throws(() => evaluateQuestionPriorAdapterCandidate({ ...request, answers: { a: null } }));
});

test('pinned PR118 examples retain independently checked completion-day goldens and explicit gate differences', () => {
  const fixture = JSON.parse(readFileSync(new URL('../../packages/prediction/tests/fixtures-pr118.json', import.meta.url), 'utf8'));
  const report = verifyFixtureSet(fixture);
  assert.equal(report.caseCount, 18);
  assert.equal(report.independentlyVerifiedNontrivialDpCases, 9);
  const golden = { F03: [3, 6], F06: [4, 5], F07: [3, 11], F08: [2, 4], F09: [2, 4],
    F10: [2, 3], F11: [6, 7], F13: [4, 5], F14: [2, 2], F17: [0, 0], F18: [null, null] };
  for (const row of report.cases) {
    if (Object.hasOwn(golden, row.id)) assert.deepEqual([row.completion.p50Days, row.completion.p80Days], golden[row.id]);
  }
  assert.equal(report.gateDifferenceIds.length, 13);
  assert.equal(report.priorErrorDifference.actual, 'RangeError');
  assert.equal(report.adapterPriorError.className, 'PredictionConfigError');
});
