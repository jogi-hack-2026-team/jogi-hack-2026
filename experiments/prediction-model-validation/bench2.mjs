// 最適化版DP: バッファ再利用・到達不能状態の刈り込み・範囲限定
import { readFileSync } from 'node:fs';
const src = readFileSync('./bench.mjs', 'utf8').split('function completion')[0];
const { seedFor, splitmix32, beta } = await import('data:text/javascript,' + encodeURIComponent(src + '\nexport { seedFor, splitmix32, beta };'));
function completion(need, post, K, H) {
  const mix = new Float64Array(H + 1);
  let D = new Float64Array(need), S = new Float64Array(need), nD = new Float64Array(need), nS = new Float64Array(need);
  for (let m = 0; m < K; m++) { const n = splitmix32(seedFor(20261012, m));
    const a = beta(post.a[0], post.a[1], n), b = beta(post.b[0], post.b[1], n);
    D.fill(0); S.fill(0); D[0] = 1; let lo = 0, hi = 0; // 非ゼロのkの範囲
    for (let d = 1; d <= H; d++) {
      const kmin = Math.max(lo, need - (H - d + 1)); if (kmin > hi) break; // 残り日数で届かない
      const top = Math.min(hi + 1, need - 1);
      nD.fill(0, kmin, top + 1); nS.fill(0, kmin, top + 1);
      let alive = 0;
      for (let k = kmin; k <= hi; k++) { const dk = D[k], sk = S[k]; const pd = dk * a + sk * b, ps = dk + sk - pd;
        if (k + 1 >= need) mix[d] += pd / K; else { nD[k + 1] += pd; alive += pd; } nS[k] += ps; alive += ps; }
      [D, nD] = [nD, D]; [S, nS] = [nS, S]; lo = kmin; hi = top;
      if (alive < 1e-9) break;
    }
  }
  let c = 0, p50 = null, p80 = null; for (let d = 0; d <= H; d++) { c += mix[d]; if (p50 === null && c >= 0.5) p50 = d; if (p80 === null && c >= 0.8) { p80 = d; break; } }
  return { p50, p80 };
}
for (const need of [120, 400, 600, 800, 1000, 1095]) for (const [label, post] of [['30日相当', { a: [14, 7], b: [7, 9] }], ['高実行率', { a: [60, 3], b: [8, 3] }]]) {
  const t0 = performance.now(); const r = completion(need, post, 200, 1095);
  console.log(`need=${need} ${label}: ${(performance.now() - t0).toFixed(0)} ms p50=${r.p50} p80=${r.p80}`);
}
