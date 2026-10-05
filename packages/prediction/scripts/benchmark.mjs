import { performance } from 'node:perf_hooks';
import { cpus, totalmem, platform, release, arch } from 'node:os';
import { predict, DEFAULT_CONFIG } from '../dist/src/index.js';

// T-14では実際の入口を呼び、入力検証・観測集計・乱数抽選・DPを含めて計測する。
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--include-midpoint')) {
  throw new Error('Usage: node scripts/benchmark.mjs [--include-midpoint]');
}
const requiredCounts = [120, 400, 1095];
const counts = args.length ? [120, 400, 548, 1095] : requiredCounts;
const runs = [3, 3, 3, 3, 3, 3, 3, 2, 3, 1, 3];
const logs = runs.flatMap((length, run) => Array.from({ length }, () => ({
  status: run % 2 === 0 ? 'DONE' : 'SKIPPED', amount: run % 2 === 0 ? 1 : null,
}))).map((log, index) => ({ ...log, localDate: `2026-10-${String(index + 1).padStart(2, '0')}` }));
const cases = [];
for (const requiredFutureDone of counts) {
  const input = { goal: { totalRequired: 19 + requiredFutureDone, initialProgress: 0, sessionAmount: 1 },
    logs, today: '2026-10-31' };
  let result;
  const measuredMs = [];
  for (let iteration = 0; iteration < 6; iteration++) {
    const start = performance.now();
    result = predict(input);
    measuredMs.push(performance.now() - start);
  }
  const warm = measuredMs.slice(1).toSorted((a, b) => a - b);
  cases.push({ requiredFutureDone, requiredByT14: requiredCounts.includes(requiredFutureDone),
    input, observations: result.observations, posterior: result.posterior,
    completion: result.completion, firstMs: measuredMs[0], warmMs: measuredMs.slice(1),
    medianWarmMs: warm[2], maxMs: Math.max(...measuredMs), pass: measuredMs.every(value => value < 500) });
}
console.log(JSON.stringify({ criterion: 'T-14: each real predict call <500ms; no probability pruning',
  limitation: 'Measured representative inputs on this machine; not a worst-case or deployment guarantee. 548 is informational only.',
  environment: { node: process.version, platform: platform(), release: release(), arch: arch(),
    cpu: cpus()[0]?.model, logicalCpuCount: cpus().length, memoryGiB: totalmem() / 2 ** 30,
    // Actionsの公開実行情報だけを記録し、認証情報やアプリ用の環境変数は読まない。
    ...(process.env.GITHUB_ACTIONS === 'true' ? { actions: {
      checkoutSha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT, runnerOs: process.env.RUNNER_OS,
      runnerArch: process.env.RUNNER_ARCH,
    } } : {}) },
  config: DEFAULT_CONFIG, cases }, null, 2));
if (cases.some(row => row.requiredByT14 && !row.pass)) process.exitCode = 1;
