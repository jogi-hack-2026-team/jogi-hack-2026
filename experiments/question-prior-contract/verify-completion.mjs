// Supporting実験。共有samplerと公開済みDPを使い、条件付き分布だけを独立式で照合する。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { arch, platform } from 'node:os';
import { pathToFileURL } from 'node:url';
import { samplePosterior } from '../../packages/prediction/dist/src/random.js';
import { completionPmf, mixtureCompletionQuantiles } from '../../packages/prediction/dist/src/completion.js';
import { observe } from '../../packages/prediction/dist/src/observations.js';

function choose(n, k) {
  let value = 1;
  for (let j = 1; j <= k; j++) value = value * (n - j + 1) / j;
  return value;
}
function negativeBinomialCdf(trials, successes, b) {
  if (successes === 0) return trials >= 0 ? 1 : 0;
  if (trials < successes || b === 0) return 0;
  if (b === 1) return 1;
  let failure = 0;
  for (let j = 0; j < successes; j++) {
    failure += choose(trials, j) * b ** j * (1 - b) ** (trials - j);
  }
  return 1 - failure;
}

// DONEから次のDONEへの待ち時間の和。NBのCDFをBinomial-tailに還元し、状態DPを使わない。
export function closedCompletionCdf(a, b, initialState, requiredFutureDone, day) {
  if (requiredFutureDone === 0) return 1;
  if (day < requiredFutureDone) return 0;
  const doneWaits = requiredFutureDone - (initialState === 'SKIPPED' ? 1 : 0);
  const firstSkip = initialState === 'SKIPPED' ? 1 : 0;
  let cdf = 0;
  for (let misses = 0; misses <= doneWaits; misses++) {
    cdf += choose(doneWaits, misses) * a ** (doneWaits - misses) * (1 - a) ** misses *
      negativeBinomialCdf(day - doneWaits, misses + firstSkip, b);
  }
  return cdf;
}

function checkedGoldenInputs(document, evidence) {
  // Derive the conditional calculation key from raw input before trusting frozen results.
  // Validate every case before drawing samples or replaying any DP.
  return evidence.cases.map(golden => {
    const fixture = document.calculationExamples.find(c => c.id === golden.id);
    assert.ok(fixture, golden.id);
    const { counts, actualDone, todayStatus } = observe(fixture.input);
    const prior = name => ['LOW', 'MID', 'HIGH'].includes(fixture.answers[name])
      ? document.mappingCandidate.values[fixture.answers[name]]
      : { alpha: fixture.config.prior, beta: fixture.config.prior };
    const a = prior('a'), b = prior('b');
    const posterior = {
      a: { alpha: a.alpha + counts.nDD, beta: a.beta + counts.nDS },
      b: { alpha: b.alpha + counts.nSD, beta: b.beta + counts.nSS },
    };
    const projected = actualDone + (todayStatus === 'UNRECORDED' ? fixture.input.goal.sessionAmount : 0);
    const remaining = BigInt(Math.max(0, fixture.input.goal.totalRequired - projected));
    const amount = BigInt(fixture.input.goal.sessionAmount);
    const key = { posterior, requiredFutureDone: Number((remaining + amount - 1n) / amount),
      initialState: todayStatus === 'SKIPPED' ? 'SKIPPED' : 'DONE',
      samples: fixture.config.samples, seed: fixture.config.seed, horizonDays: fixture.config.horizonDays };
    const frozen = { posterior: golden.posterior, requiredFutureDone: golden.requiredFutureDone,
      initialState: golden.initialState, ...evidence.config };
    for (const field of Object.keys(key)) {
      assert.deepEqual(key[field], frozen[field], `${golden.id}: completion golden key mismatch (${field})`);
    }
    assert.deepEqual(fixture.expected.posterior, posterior, `${golden.id}: fixture posterior mismatch`);
    assert.equal(fixture.expected.completion.requiredFutureDone, key.requiredFutureDone, `${golden.id}: fixture future count mismatch`);
    assert.equal(fixture.expected.todayStatus, todayStatus, `${golden.id}: fixture todayStatus mismatch`);
    assert.deepEqual(fixture.config, document.configUnchanged);
    return { fixture, golden };
  });
}

export function replayGoldens(
  document = JSON.parse(readFileSync(new URL('./common-fixtures.json', import.meta.url), 'utf8')),
  evidence = JSON.parse(readFileSync(new URL('./completion-goldens.json', import.meta.url), 'utf8')),
) {
  const inputs = checkedGoldenInputs(document, evidence);
  const cases = [];
  for (const { fixture, golden } of inputs) {
    const { samples, horizonDays: h, seed } = fixture.config;
    const draws = samplePosterior(golden.posterior, samples, seed);
    const drawSha256 = createHash('sha256').update(JSON.stringify(draws)).digest('hex');
    assert.equal(drawSha256, golden.drawSha256, `${golden.id}: frozen runtime/sampler draw mismatch`);
    const result = mixtureCompletionQuantiles(draws, golden.initialState, golden.requiredFutureDone, h);
    assert.deepEqual(result, { p50Days: golden.p50Days, p80Days: golden.p80Days });
    assert.equal(fixture.expected.completion.p50Days, result.p50Days);
    assert.equal(fixture.expected.completion.p80Days, result.p80Days);
    const productionCdf = Array(h + 1).fill(0);
    let maxPmfPruningDifference = 0;
    for (const draw of draws) {
      const args = { ...draw, initialState: golden.initialState, requiredFutureDone: golden.requiredFutureDone, horizonDays: h };
      const pmf = completionPmf(args);
      const unpruned = completionPmf({ ...args, prune: false });
      let accumulated = 0;
      for (let day = 1; day <= h; day++) {
        maxPmfPruningDifference = Math.max(maxPmfPruningDifference, Math.abs(pmf[day] - unpruned[day]));
        accumulated += pmf[day]; productionCdf[day] += accumulated / draws.length;
      }
    }
    let maxCdfError = 0, p50Days = null, p80Days = null;
    const boundary = {};
    for (let day = 1; day <= h; day++) {
      const cdf = draws.reduce((sum, draw) => sum +
        closedCompletionCdf(draw.a, draw.b, golden.initialState, golden.requiredFutureDone, day) / draws.length, 0);
      maxCdfError = Math.max(maxCdfError, Math.abs(cdf - productionCdf[day]));
      for (const q of [.5, .8]) {
        if (!boundary[q] && cdf >= q - 1e-12) {
          const previousCdf = day === 1 ? 0 : draws.reduce((sum, draw) => sum +
            closedCompletionCdf(draw.a, draw.b, golden.initialState, golden.requiredFutureDone, day - 1) / draws.length, 0);
          boundary[q] = { day, cdf, previousCdf };
          assert.ok(previousCdf < q - 1e-12);
        }
      }
      if (p50Days === null && cdf >= .5 - 1e-12) p50Days = day;
      if (p80Days === null && cdf >= .8 - 1e-12) p80Days = day;
    }
    assert.ok(maxCdfError < 1e-11, `${golden.id}: conditional CDF mismatch`);
    assert.equal(maxPmfPruningDifference, 0);
    assert.deepEqual({ p50Days, p80Days }, result);
    cases.push({ id: golden.id, ...result, drawSha256, maxCdfError, maxPmfPruningDifference, boundary });
  }
  assert.equal(cases.length, 9);
  return {
    status: 'PASS: conditional DP replay only / Supporting proposal / not adopted',
    sourceProposalHead: evidence.sourceProposalHead,
    environment: { node: process.version, platform: platform(), arch: arch() },
    config: evidence.config, nontrivialCases: cases.length, cases,
    maxCdfError: Math.max(...cases.map(c => c.maxCdfError)),
    independence: evidence.independence,
    remaining: ['public Engine/API adoption of gate/source/version/error contracts; PR119 candidate is not exercised by this math replayer',
      'saved context/revision and API/DB/UI integration', 'runtime adoption and selected-prior performance',
      'calibration, prediction accuracy and user understanding'],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = replayGoldens();
  writeFileSync(new URL('./completion-replay-results.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ status: result.status, nontrivialCases: result.nontrivialCases,
    environment: result.environment, maxCdfError: result.maxCdfError,
    goldens: result.cases.map(c => ({ id: c.id, p50Days: c.p50Days, p80Days: c.p80Days })) }, null, 2));
}
