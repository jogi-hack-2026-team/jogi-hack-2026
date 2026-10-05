import { performance } from 'node:perf_hooks';
import { cpus, totalmem, platform, release, arch } from 'node:os';
import { DEFAULT_CONFIG } from '../dist/src/index.js';
import { evaluateGoalPriorCandidate } from '../dist/src/goal-prior-candidate.js';

// D-26の強度・数値写像ではない合成パラメータ。同じ実Engine経路を代表入力で計測する。
const prior = { a: { alpha: 3, beta: 7, source: 'synthetic-benchmark', version: 'fixture-v1' },
  b: { alpha: 5, beta: 11, source: 'synthetic-benchmark', version: 'fixture-v1' } };
const config = { modelVersion: DEFAULT_CONFIG.modelVersion, samples: DEFAULT_CONFIG.samples,
  horizonDays: DEFAULT_CONFIG.horizonDays, seed: DEFAULT_CONFIG.seed };
const runs = [3, 3, 3, 3, 3, 3, 3, 2, 3, 1, 3];
const logs = runs.flatMap((length, run) => Array.from({ length }, () => ({
  status: run % 2 === 0 ? 'DONE' : 'SKIPPED', amount: run % 2 === 0 ? 1 : null,
}))).map((log, index) => ({ ...log, localDate: `2026-10-${String(index + 1).padStart(2, '0')}` }));
const cases = [];
for (const requiredFutureDone of [120, 400, 1095]) {
  const input = { goal: { totalRequired: 19 + requiredFutureDone, initialProgress: 0, sessionAmount: 1 },
    logs, today: '2026-10-31' };
  let result;
  const measuredMs = [];
  for (let iteration = 0; iteration < 6; iteration++) {
    const start = performance.now();
    result = evaluateGoalPriorCandidate(input, prior, config);
    measuredMs.push(performance.now() - start);
  }
  cases.push({ requiredFutureDone, input, priorSnapshot: result.priorSnapshot,
    observations: result.observations, posterior: result.posterior, completion: result.completion,
    measuredMs, maxMs: Math.max(...measuredMs), pass: measuredMs.every(value => value < 500) });
}
console.log(JSON.stringify({ criterion: 'Existing T-14 comparison: each real calculation <500ms; K=200/H=1095',
  limitation: 'Internal candidate and synthetic prior on this machine; no D-26 adoption, production or worst-case guarantee.',
  environment: { node: process.version, platform: platform(), release: release(), arch: arch(),
    cpu: cpus()[0]?.model, logicalCpuCount: cpus().length, memoryGiB: totalmem() / 2 ** 30 },
  config, cases }, null, 2));
if (cases.some(row => !row.pass)) process.exitCode = 1;
