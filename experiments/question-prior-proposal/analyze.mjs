// Supporting Artifact. Sensitivity arithmetic, not calibration or observed people.
import fs from 'node:fs';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { posteriorFromRaw, betaGeometricQuantile, priorWeight, makeInitialPrior, evaluate } from './src/prototype.ts';
import { completionPmf, drawsFromPosterior, quantileDays } from './reference/completion-dp.mjs';
const shapes = [[3, 1], [2, 2], [1, 3]], seed = 20261012, K = 200, H = 1095;
const summarize = (a, b, need, useSeed = seed) => {
  const pmf = completionPmf(need, drawsFromPosterior({ a, b }, K, useSeed), H, 'D');
  return { g50: betaGeometricQuantile(b, 50), g80: betaGeometricQuantile(b, 80),
    p50: quantileDays(pmf, .5, H), p80: quantileDays(pmf, .8, H), tailBeyondH: pmf[H + 1],
    meanWait: b[0] === 1 ? 'Infinity (not displayed)' : (b[0] + b[1] - 1) / (b[0] - 1) };
};
const candidates = [];
for (const strength of [4, 8]) for (const x of shapes) for (const y of shapes) {
  const a = x.map(n => n * strength / 4), b = y.map(n => n * strength / 4);
  candidates.push({ strength, a, b, ...summarize(a, b, 9) });
}
const sensitivity = [];
for (const strength of [4, 8]) for (const origin of ['D', 'S']) for (const n of [0, 1, 4, 12]) for (const outcome of ['success', 'failure', 'half']) {
  const prior = { a: [3 * strength / 4, strength / 4], b: [3 * strength / 4, strength / 4] };
  const s = outcome === 'success' ? n : outcome === 'failure' ? 0 : Math.floor(n / 2), f = n - s;
  const counts = { dd: origin === 'D' ? s : 0, ds: origin === 'D' ? f : 0, sd: origin === 'S' ? s : 0, ss: origin === 'S' ? f : 0 };
  const post = posteriorFromRaw(prior, counts);
  sensitivity.push({ strength, origin, n, outcome, syntheticIndependentOriginCounts: counts, posterior: post,
    priorWeight: priorWeight(prior[origin === 'D' ? 'a' : 'b'], n), meanA: post.a[0] / (post.a[0] + post.a[1]), meanB: post.b[0] / (post.b[0] + post.b[1]), g50: betaGeometricQuantile(post.b, 50), g80: betaGeometricQuantile(post.b, 80) });
}
const seedSensitivity = [4, 8].flatMap(strength => [9, 120].flatMap(need => [seed, seed + 1, seed + 2, seed + 3, seed + 4].map(s => ({ strength, need, seed: s, ...summarize([strength / 4, 3 * strength / 4], [strength / 4, 3 * strength / 4], need, s) }))));
const timings = [];
for (const strength of [4, 8]) for (const need of [120, 400, 1095]) {
  const draws = drawsFromPosterior({ a: [strength / 4, 3 * strength / 4], b: [strength / 4, 3 * strength / 4] }, K, seed);
  completionPmf(need, draws, H); const ms = [];
  for (let i = 0; i < 3; i++) { const begin = performance.now(); completionPmf(need, draws, H); ms.push(performance.now() - begin); }
  timings.push({ strength, need, ms, measuredPart: 'reference DP only', oneWarmup: true });
}
const goal = { totalRequired: 100, initialProgress: 0, sessionAmount: 10, frequency: 'daily', actionSpec: 'same-action:10-minutes:daily:v1' };
const answers = { experience: 'same_action', afterDone: 'often', afterSkip: 'rarely' };
const prior = makeInitialPrior(answers, goal.actionSpec);
const snapshotRoundTrip = JSON.parse(JSON.stringify(prior));
const sha = file => createHash('sha256').update(fs.readFileSync(new URL(file, import.meta.url))).digest('hex');
const sourceNames = ['src/prototype.ts', 'test/prototype.test.mjs', 'test/type-contract.ts', 'reference/completion-dp.mjs', 'analyze.mjs', 'historical/run.mjs', 'historical/REPORT.md', 'historical/README.md', 'historical/results/raw.json', 'historical/results/summary.json'];
const out = {
  label: 'Supporting Artifact / Not a Source of Truth; uncalibrated candidates; synthetic arithmetic only',
  environment: { timestamp: new Date().toISOString(), node: process.version, platform: os.platform(), cpu: os.cpus()[0].model, K, H, seed },
  historical: { sourceRepoHead: 'af001c6e797b9833a63234bd1646171ac8e8c542', recordedChecks: 580, rawSha256: sha('historical/results/raw.json'), notHumanValidation: true },
  sourceHashes: Object.fromEntries(sourceNames.map(file => [file, sha(file)])), candidates, sensitivity,
  sensitivityCaveat: 'Independent origin stress inputs, never persisted as ActionLogs or treated as one observed chronology.',
  seedSensitivity, timings, persistedExample: snapshotRoundTrip,
  examples: { questionnaireOnly: evaluate(goal, [], '2026-10-04', snapshotRoundTrip, 'questionnaire_draft'),
    unknown: evaluate(goal, [], '2026-10-04', makeInitialPrior({ ...answers, experience: 'unknown' }, goal.actionSpec), 'questionnaire_draft'),
    baseline: evaluate(goal, [], '2026-10-04', prior, 'baseline') },
};
fs.writeFileSync(new URL('./results/analysis.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ candidates: candidates.length, sensitivityRows: sensitivity.length, seedCases: seedSensitivity.length, maxReferenceDpMs: Math.max(...timings.flatMap(t => t.ms)), historicalChecks: 580, rawSha256: out.historical.rawSha256 }, null, 2));
