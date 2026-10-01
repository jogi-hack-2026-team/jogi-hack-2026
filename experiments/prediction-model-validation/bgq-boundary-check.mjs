// Beta-Geometric分位点の境界の回帰チェック（PR #86レビュー対応）
// 1) CDFが閾値にちょうど一致する既知の例
// 2) α=2の閉形式 P(G>t) = β(β+1)/((β+t)(β+t+1)) との照合（独立な計算）
// 3) 旧実装（lBの差のexp）との不一致件数の記録
const bgQ = (al, be, q) => {
  if (!Number.isInteger(al) || !Number.isInteger(be)) throw new Error('bgQ requires integer alpha/beta');
  const qn = BigInt(Math.round(q * 10)), A = BigInt(al), B = BigInt(be); let N = 1n, D = 1n;
  for (let t = 1; t < 100000; t++) { const i = BigInt(t - 1); N *= B + i; D *= A + B + i; if (10n * N <= (10n - qn) * D) return t; }
  return Infinity;
};
const fail = [];
const expect = (name, got, want) => { if (got !== want) fail.push(`${name}: got ${got}, want ${want}`); };

// 1) 境界例。(5,5)：P(G>1) = 5/10 = 0.5 → g50 = 1。(2,2)：P(G>1) = 1/2 → g50 = 1、P(G>3) = 6/30 = 0.2 → g80 = 3
expect('g50(5,5)', bgQ(5, 5, 0.5), 1);
expect('g50(2,2)', bgQ(2, 2, 0.5), 1);
expect('g80(2,2)', bgQ(2, 2, 0.8), 3);
expect('g50(5,9)  10回中3回の例', bgQ(5, 9, 0.5), 2);

// 2) α=2の閉形式（整数で比較）
const closedQ = (be, q) => { const qn = BigInt(Math.round(q * 10)), B = BigInt(be);
  for (let t = 1n; t < 100000n; t++) { const N = B * (B + 1n), D = (B + t) * (B + t + 1n); if (10n * N <= (10n - qn) * D) return Number(t); } return Infinity; };
let closedCases = 0;
for (let be = 2; be <= 200; be++) for (const q of [0.5, 0.8]) { closedCases++; expect(`alpha=2 beta=${be} q=${q}`, bgQ(2, be, q), closedQ(be, q)); }

// 3) 旧実装との差（記録のみ）
const lg = z => { const k = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lg(1 - z); z -= 1; let x = k[0]; for (let i = 1; i < 9; i++) x += k[i] / (z + i); const t = z + 7.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x); };
const lB = (x, y) => lg(x) + lg(y) - lg(x + y);
const oldQ = (al, be, q) => { for (let t = 1; t < 1e5; t++) if (1 - Math.exp(lB(al, be + t) - lB(al, be)) >= q) return t; return Infinity; };
let total = 0, diff = 0;
for (let a = 2; a <= 20; a++) for (let b = 2; b <= 20; b++) for (const q of [0.5, 0.8]) { total++; if (oldQ(a, b, q) !== bgQ(a, b, q)) diff++; }

console.log(`node ${process.version}`);
console.log(`境界例4件・α=2の閉形式${closedCases}件: ${fail.length === 0 ? 'PASS' : 'FAIL'}`);
if (fail.length) { console.log(fail.join('\n')); process.exitCode = 1; }
console.log(`旧実装との不一致（α,β=2〜20、q=0.5/0.8）: ${diff} / ${total}`);
