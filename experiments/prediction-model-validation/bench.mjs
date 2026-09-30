// 仕様どおりのPRNG・サンプラー・DP（到達不能な状態の刈り込みあり/なし）を計測
const fmix32 = h => { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; };
const seedFor = (seed, m) => fmix32((seed ^ Math.imul(m + 1, 0x9e3779b9)) >>> 0);
function splitmix32(s) { let state = s >>> 0; return () => { state = (state + 0x9e3779b9) >>> 0; let z = state;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad); z = Math.imul(z ^ (z >>> 15), 0x735a2d97); z ^= z >>> 15; return z >>> 0; }; }
const uniform = next => (next() + 0.5) / 4294967296;
const normal = next => Math.sqrt(-2 * Math.log(uniform(next))) * Math.cos(2 * Math.PI * uniform(next));
function gamma(alpha, next) { const d = alpha - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) { let x, v; do { x = normal(next); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = uniform(next);
    if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v; } }
const beta = (a, b, next) => { const x = gamma(a, next); return x / (x + gamma(b, next)); };

console.log('test vectors: seedFor(20261012,0..2) =', [0, 1, 2].map(m => seedFor(20261012, m)));
{ const n = splitmix32(seedFor(20261012, 0)); console.log('splitmix32 first 3 =', [n(), n(), n()]); }
{ const n = splitmix32(seedFor(20261012, 0)); const a = beta(14, 7, n), b = beta(7, 9, n); console.log('draw m=0 Beta(14,7),Beta(7,9) =', a, b); }

function completion(need, post, K, H, prune) {
  const mix = new Float64Array(H + 2);
  for (let m = 0; m < K; m++) { const n = splitmix32(seedFor(20261012, m));
    const a = beta(post.a[0], post.a[1], n), b = beta(post.b[0], post.b[1], n);
    let D = new Float64Array(need), S = new Float64Array(need); D[0] = 1; let rest = 1;
    for (let d = 1; d <= H && rest > 1e-9; d++) { const nD = new Float64Array(need), nS = new Float64Array(need);
      const kmin = prune ? Math.max(0, need - (H - d + 1)) : 0; // これ未満のkはH日以内に届かない
      const kmax = Math.min(need - 1, d - 1);
      for (let k = kmin; k <= kmax; k++) { const pd = D[k] * a + S[k] * b, ps = D[k] * (1 - a) + S[k] * (1 - b);
        if (k + 1 >= need) { mix[d] += pd / K; rest -= pd; } else nD[k + 1] += pd; nS[k] += ps; }
      if (prune && kmin > 0) { let lost = 0; for (let k = 0; k < kmin; k++) lost += D[k] + S[k]; } // 刈った質量は未到達扱い
      D = nD; S = nS; }
  }
  let c = 0, p50 = null, p80 = null; for (let d = 0; d <= H; d++) { c += mix[d]; if (p50 === null && c >= 0.5) p50 = d; if (p80 === null && c >= 0.8) { p80 = d; break; } }
  return { p50, p80 };
}
for (const need of [120, 400, 1095]) for (const [label, post] of [['30日相当', { a: [14, 7], b: [7, 9] }], ['高実行率', { a: [60, 3], b: [8, 3] }]]) for (const prune of [false, true]) {
  const t0 = performance.now(); const r = completion(need, post, 200, 1095, prune);
  console.log(`need=${need} ${label} prune=${prune}: ${(performance.now() - t0).toFixed(0)} ms p50=${r.p50} p80=${r.p80}`);
}
