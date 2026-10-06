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

test('zero/horizon cases remain separate from nine nontrivial goldens and original numeric-entry comparisons remain historical', () => {
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

const document = JSON.parse(readFileSync(new URL('./common-fixtures.json', import.meta.url), 'utf8'));
const evidence = JSON.parse(readFileSync(new URL('./completion-goldens.json', import.meta.url), 'utf8'));
const f06 = data => data.calculationExamples.find(c => c.id === 'F06');
const changeConfig = (data, field, value) => {
  data.configUnchanged[field] = value;
  for (const fixture of data.calculationExamples) fixture.config[field] = value;
};
const changedKeys = [
  ['posterior', data => { f06(data).answers.a = 'MID'; }],
  ['requiredFutureDone', data => { f06(data).input.goal.totalRequired += 15; }],
  ['initialState', data => {
    const fixture = f06(data);
    fixture.input.goal.initialProgress = 75;
    fixture.input.logs = [{ localDate: fixture.input.today, status: 'SKIPPED', amount: null }];
    fixture.expected.todayStatus = 'SKIPPED';
    fixture.expected.progress.done = 75;
    fixture.expected.completion.scenario = 'CURRENT_STATE';
  }],
  ['samples', data => changeConfig(data, 'samples', data.configUnchanged.samples + 1)],
  ['seed', data => changeConfig(data, 'seed', data.configUnchanged.seed + 1)],
  ['horizonDays', data => changeConfig(data, 'horizonDays', data.configUnchanged.horizonDays - 1)],
];
for (const [field, change] of changedKeys) {
  test(`rejects changed completion golden key ${field} before replay`, () => {
    const changed = structuredClone(document);
    change(changed);
    assert.throws(() => replayGoldens(changed, evidence),
      error => error.code === 'ERR_ASSERTION' && error.message.includes(`golden key mismatch (${field})`));
  });
}

test('rejects stale today metadata even when DONE recording preserves the conditional golden key', () => {
  const changed = structuredClone(document), fixture = f06(changed);
  fixture.input.logs = [{ localDate: fixture.input.today, status: 'DONE', amount: 15 }];
  assert.throws(() => replayGoldens(changed, evidence), /F06: fixture todayStatus mismatch/);
});
