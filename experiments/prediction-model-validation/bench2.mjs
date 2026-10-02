// 完了の目安DPの最悪ケースの計測（仕様どおりの乱数・サンプラー、配列の使い回し、届かない状態の刈り込み）
// 微小確率の打ち切りはしない（PR #86レビュー。DPの本体は completion-dp.mjs）
import { seedFor, splitmix32, beta, drawsFromPosterior, completionPmf, quantileDays } from './completion-dp.mjs';

console.log('test vectors: seedFor(20261012,0..2) =', [0, 1, 2].map(m => seedFor(20261012, m)));
{ const n = splitmix32(seedFor(20261012, 0)); console.log('splitmix32 first 3 =', [n(), n(), n()]); }
{ const n = splitmix32(seedFor(20261012, 0)); const a = beta(14, 7, n), b = beta(7, 9, n); console.log('draw m=0 Beta(14,7),Beta(7,9) =', a, b); }

const H = 1095;
for (const need of [120, 400, 600, 800, 1000, 1095]) for (const [label, post] of [['30日相当', { a: [14, 7], b: [7, 9] }], ['高実行率', { a: [60, 3], b: [8, 3] }]]) {
  const t0 = performance.now();
  const mix = completionPmf(need, drawsFromPosterior(post, 200), H, 'D');
  const ms = performance.now() - t0;
  console.log(`need=${need} ${label}: ${ms.toFixed(0)} ms p50=${quantileDays(mix, 0.5, H)} p80=${quantileDays(mix, 0.8, H)}`);
}
