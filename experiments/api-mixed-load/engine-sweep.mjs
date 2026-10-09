// Supporting Artifact / Not a Source of Truth (Issue #161).
// 純粋Engineの predict を requiredFutureDone の値ごとに単体計測し、この端末での最も重い入力を探す。
// run.ts の合成記録（60日、3日に1回SKIPPED）と同じ形を使う。T-14の判定値を変えるものではない。
//   node experiments/api-mixed-load/engine-sweep.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CONFIG, predict } from '@futureroi/prediction';

const SESSION_AMOUNT = 30;
const LOG_DAYS = 60;
const TODAY = '2026-10-09';
const SIZES = [30, 60, 120, 200, 300, 400, 548, 700, 800, 900, 1000, 1050, 1080, 1090, 1093, 1094, 1095, 1200];
const ITERATIONS = 6;

const day = (offset) => {
  const d = new Date(Date.UTC(2026, 9, 9));
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
};
// run.ts の利用者1（i=0）と同じ並び: d=2..61、(d*7)%3===0 の日がSKIPPED。
const logs = Array.from({ length: LOG_DAYS }, (_, k) => {
  const d = k + 2;
  const skipped = (d * 7) % 3 === 0;
  return { localDate: day(d), status: skipped ? 'SKIPPED' : 'DONE', amount: skipped ? null : SESSION_AMOUNT };
}).reverse();
const done = logs.reduce((s, l) => s + (l.amount ?? 0), 0);

const cases = [];
for (const size of SIZES) {
  const input = { goal: { totalRequired: done + SESSION_AMOUNT * (size + 1), initialProgress: 0, sessionAmount: SESSION_AMOUNT }, logs, today: TODAY };
  const ms = [];
  let result;
  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    result = predict(input);
    ms.push(performance.now() - t0);
  }
  const warm = ms.slice(1).toSorted((a, b) => a - b);
  cases.push({
    requiredFutureDone: size,
    firstMs: Math.round(ms[0] * 100) / 100,
    medianWarmMs: Math.round(warm[Math.floor(warm.length / 2)] * 100) / 100,
    maxMs: Math.round(Math.max(...ms) * 100) / 100,
    completion: result.completion.status === 'available' ? { p50Days: result.completion.p50Days, p80Days: result.completion.p80Days } : result.completion.status,
  });
  console.log(`${String(size).padStart(5)} | first ${String(cases.at(-1).firstMs).padStart(7)}ms | median warm ${String(cases.at(-1).medianWarmMs).padStart(7)}ms | max ${String(cases.at(-1).maxMs).padStart(7)}ms | ${JSON.stringify(cases.at(-1).completion)}`);
}
const heaviest = cases.reduce((a, b) => (b.maxMs > a.maxMs ? b : a));
console.log(`heaviest: requiredFutureDone=${heaviest.requiredFutureDone} max ${heaviest.maxMs}ms`);

const here = dirname(fileURLToPath(import.meta.url));
const tag = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15);
const outDir = join(here, 'results', tag);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'engine-sweep.json'), JSON.stringify({
  label: 'Supporting Artifact / Not a Source of Truth (Issue #161)',
  at: new Date().toISOString(), node: process.version, cpu: cpus()[0]?.model, logicalCpus: cpus().length,
  config: DEFAULT_CONFIG, logShape: { logDays: LOG_DAYS, sessionAmount: SESSION_AMOUNT, skippedEvery: '(d*7)%3===0', today: TODAY }, iterations: ITERATIONS,
  cases, heaviest: heaviest.requiredFutureDone,
  limitation: 'Single machine, one log shape. The heaviest size here is not a proven worst case over all inputs.',
}, null, 2) + '\n');
console.log(`-> ${outDir}/engine-sweep.json`);
