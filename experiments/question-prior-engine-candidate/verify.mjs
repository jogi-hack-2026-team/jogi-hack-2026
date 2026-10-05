import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { cpus, platform, arch } from 'node:os';
import { createHash } from 'node:crypto';
import { evaluateGoalPriorCandidate } from '../../packages/prediction/dist/src/goal-prior-candidate.js';
import { evaluateQuestionPriorAdapterCandidate } from '../../packages/prediction/dist/src/question-prior-adapter-candidate.js';
import { samplePosterior } from '../../packages/prediction/dist/src/random.js';
import { completionPmf } from '../../packages/prediction/dist/src/completion.js';
import { PredictionInputError } from '../../packages/prediction/dist/src/index.js';

export const proposalHead = 'c3bd5efd2e447fb7a021ad7c27a61de2127dd33a';

// N個のDONE待ち時間は、即翌日DONEする回数と、Geometric(b)へ入る回数の混合。
// NB(r,b)<=t は Binomial(t,b)>=r。日ごとの状態DPとは独立な閉形式でCDFを計算する。
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
  for (let j = 0; j < successes; j++) failure += choose(trials, j) * b ** j * (1 - b) ** (trials - j);
  return 1 - failure;
}
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

export function evaluateProposalFixture(fixture, mapping) {
  // 実験内にgate実装を複製せず、型付き候補adapterの実際の入力→出力を検証する。
  const result = evaluateQuestionPriorAdapterCandidate({ prediction: fixture.input, answers: fixture.answers,
    mapping: { version: mapping.version, values: mapping.values } }, fixture.config);
  const baseline = evaluateGoalPriorCandidate(fixture.input, result.priorSnapshot, fixture.config);
  let requiredFutureDone = null, draws = [];
  if (result.completion.status === 'available') {
    const remaining = fixture.input.goal.totalRequired - result.progress.done -
      (result.todayStatus === 'UNRECORDED' ? fixture.input.goal.sessionAmount : 0);
    const amount = BigInt(fixture.input.goal.sessionAmount);
    requiredFutureDone = remaining <= 0 ? 0 : Number((BigInt(remaining) + amount - 1n) / amount);
    if (requiredFutureDone > 0 && requiredFutureDone <= fixture.config.horizonDays) {
      draws = samplePosterior(result.posterior, fixture.config.samples, fixture.config.seed);
    }
  }
  return { baseline, result, requiredFutureDone, draws };
}

export function verifyFixtureSet(document) {
  const cases = [];
  for (const fixture of document.calculationExamples) {
    const { baseline, result, requiredFutureDone, draws } = evaluateProposalFixture(fixture, document.mappingCandidate);
    const expected = fixture.expected;
    for (const field of ['todayStatus', 'progress', 'observations', 'posterior', 'evidenceSource', 'eligible', 'coreMetric']) {
      assert.deepEqual(result[field], expected[field], `${fixture.id} ${field}`);
    }
    for (const field of ['status', 'reason', 'scenario', 'p50Days', 'p80Days']) {
      if (Object.hasOwn(expected.completion, field)) assert.deepEqual(result.completion[field], expected.completion[field], `${fixture.id} ${field}`);
    }
    if (Object.hasOwn(expected.completion, 'requiredFutureDone')) assert.equal(requiredFutureDone, expected.completion.requiredFutureDone);
    assert.deepEqual(result.conditionalPlan, expected.conditionalPlan, `${fixture.id} actual adapter conditionalPlan`);
    let oracle = null;
    if (draws.length) {
      const h = fixture.config.horizonDays, initialState = result.todayStatus === 'SKIPPED' ? 'SKIPPED' : 'DONE';
      const productionCdf = Array(h + 1).fill(0);
      let maxPmfPruningDifference = 0;
      for (const sample of draws) {
        const pmf = completionPmf({ ...sample, initialState, requiredFutureDone, horizonDays: h });
        const unpruned = completionPmf({ ...sample, initialState, requiredFutureDone, horizonDays: h, prune: false });
        let accumulated = 0;
        for (let day = 1; day <= h; day++) {
          maxPmfPruningDifference = Math.max(maxPmfPruningDifference, Math.abs(pmf[day] - unpruned[day]));
          accumulated += pmf[day]; productionCdf[day] += accumulated / draws.length;
        }
      }
      let maxCdfError = 0, p50Days = null, p80Days = null;
      const boundary = {};
      for (let day = 1; day <= h; day++) {
        const cdf = draws.reduce((sum, s) => sum + closedCompletionCdf(s.a, s.b, initialState, requiredFutureDone, day) / draws.length, 0);
        maxCdfError = Math.max(maxCdfError, Math.abs(cdf - productionCdf[day]));
        for (const q of [.5, .8]) {
          if (!boundary[q] && cdf >= q - 1e-12) boundary[q] = { day, cdf,
            previousCdf: day === 1 ? 0 : draws.reduce((sum, s) => sum + closedCompletionCdf(s.a, s.b, initialState, requiredFutureDone, day - 1) / draws.length, 0) };
        }
        if (p50Days === null && cdf >= .5 - 1e-12) p50Days = day;
        if (p80Days === null && cdf >= .8 - 1e-12) p80Days = day;
      }
      assert.ok(maxCdfError < 1e-11, `${fixture.id} CDF error ${maxCdfError}`);
      assert.equal(maxPmfPruningDifference, 0);
      assert.deepEqual({ p50Days, p80Days }, { p50Days: result.completion.p50Days, p80Days: result.completion.p80Days });
      oracle = { method: 'conditional renewal + binomial-tail CDF, no state DP',
        p50Days, p80Days, maxCdfError, maxPmfPruningDifference, boundary };
    }
    cases.push({ id: fixture.id, answers: fixture.answers, input: fixture.input, config: fixture.config,
      priorSnapshot: result.priorSnapshot, posterior: result.posterior, observations: result.observations,
      progress: result.progress, evidenceSource: result.evidenceSource, eligible: result.eligible,
      coreMetric: result.coreMetric, completion: result.completion, conditionalPlan: result.conditionalPlan, requiredFutureDone, oracle,
      drawSha256: draws.length ? createHash('sha256').update(JSON.stringify(draws)).digest('hex') : null,
      draws, baselineGate: { coreMetric: baseline.coreMetric, completion: baseline.completion },
      baselineGateDiffers: JSON.stringify(baseline.coreMetric) !== JSON.stringify(result.coreMetric) ||
        JSON.stringify(baseline.completion) !== JSON.stringify(result.completion) });
  }
  const badFuture = document.negativeExamples.find(x => x.id === 'N03');
  assert.throws(() => evaluateQuestionPriorAdapterCandidate({ prediction: badFuture.input,
    answers: { a: null, b: null }, mapping: document.mappingCandidate }, badFuture.config), PredictionInputError);
  const badShape = document.negativeExamples.find(x => x.id === 'N04');
  let actualPriorError;
  try {
    evaluateGoalPriorCandidate(badShape.input, Object.fromEntries(['a', 'b'].map(name => [name,
      { ...badShape.resolvedPrior[name], source: 'synthetic-invalid', version: 'PR118-candidate' }])), document.configUnchanged);
  } catch (error) { actualPriorError = error.constructor.name; }
  assert.equal(actualPriorError, 'RangeError');
  const invalidMapping = structuredClone(document.mappingCandidate);
  invalidMapping.values.LOW = badShape.resolvedPrior.b;
  let adapterPriorError;
  try {
    evaluateQuestionPriorAdapterCandidate({ prediction: badShape.input, answers: { a: 'MID', b: 'LOW' },
      mapping: invalidMapping }, document.configUnchanged);
  } catch (error) { adapterPriorError = { className: error.constructor.name, reason: error.reason, path: error.path }; }
  assert.equal(adapterPriorError?.className, 'PredictionConfigError');
  return { status: 'PR118 PROPOSAL VERIFICATION ONLY; NOT ADOPTED', proposalHead,
    environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model },
    scope: 'Numeric mapping, counts, center quantiles and conditional DP goldens; shared production sampler, independent DP oracle. No accuracy/calibration/API/UI/runtime adoption proof.',
    caseCount: cases.length, independentlyVerifiedNontrivialDpCases: cases.filter(x => x.oracle).length,
    gateDifferenceIds: cases.filter(x => x.baselineGateDiffers).map(x => x.id),
    inputErrorVerified: 'N03 PredictionInputError', priorErrorDifference: { id: 'N04', actual: actualPriorError, proposed: 'PredictionConfigError' },
    adapterPriorError,
    integrationSpecificationsNotExecuted: document.integrationExamples.length, cases };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fixturePath = process.argv[2];
  assert.ok(fixturePath, 'Pass the pinned PR118 common-fixtures.json path');
  console.log(JSON.stringify(verifyFixtureSet(JSON.parse(readFileSync(fixturePath, 'utf8'))), null, 2));
}
