// 実験5: 恒等式の分布レベル確認 / 実験6: 事前分布の感度 / 実験7: iid vs Markov のBayes因子 / 実験8: 記録漏れ(MNAR)バイアス
import { simulate, quantile, exactDP, pmfQuantile, counts, mulberry32, mix } from './engine2.mjs';

const need = 120;
const lnB = (x, y) => lgamma(x) + lgamma(y) - lgamma(x + y);
function lgamma(z) { // Lanczos
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

console.log('## 実験5: skip分布 = do分布 ⊕ Geom(b) の確認（a=0.8,b=0.3）');
{
  const a = .8, b = .3, pd = exactDP(need, true, a, b), ps = exactDP(need, false, a, b);
  const conv = new Float64Array(pd.length);
  for (let d = 0; d < pd.length; d++) for (let t = 1; d + t < pd.length; t++) conv[d + t] += pd[d] * b * (1 - b) ** (t - 1);
  let maxErr = 0; for (let d = 0; d < 900; d++) maxErr = Math.max(maxErr, Math.abs(conv[d] - ps[d]));
  console.log(`最大誤差(0-900日) = ${maxErr.toExponential(2)}`);
}

function genLogs(a, b, n, rnd, pMissSkip = 0) {
  let s = rnd() < b / (1 - a + b); const out = [];
  for (let i = 0; i < n; i++) { if (i) s = rnd() < (s ? a : b); out.push(s ? 'D' : (rnd() < pMissSkip ? 'U' : 'S')); }
  return out;
}
// 事後予測での再開待ち日数 T の中央値: P(T>t) = B(α, β+t)/B(α,β)
// P(G>t) を積の形で逐次計算する（lnBの差のexpより境界の誤差が小さい）。事前分布が非整数の場合もあるため浮動小数点で、境界は1e-12の許容で判定する
function restartMedian(al, be) { let s = 1; for (let t = 1; t < 5000; t++) { s *= (be + t - 1) / (al + be + t - 1); if (s <= 0.5 + 1e-12) return t; } return Infinity; }
const trueRestartMedian = b => Math.max(1, Math.ceil(Math.log(0.5) / Math.log(1 - b)));

console.log('\n## 実験6: 事前分布の感度（各条件 40人の合成ユーザー、MC 400 trials）');
console.log('真値(a,b) | 日数 | prior | P50(do)の平均絶対誤差[日] | P50差の平均絶対誤差[日] | 再開待ち中央値の誤差[日] | 真のP50がP10-P90に入った割合');
const truths = [[0.8, 0.3], [0.6, 0.6], [0.5, 0.2], [0.9, 0.7]];
for (const [a, b] of truths) {
  const tDo = exactDP(need, true, a, b), tSk = exactDP(need, false, a, b);
  const t50 = pmfQuantile(tDo, .5), tDiff = pmfQuantile(tSk, .5) - t50, tRM = trueRestartMedian(b);
  for (const n of [3, 7, 14, 30, 60]) {
    for (const prior of [1 / 3, 0.5, 1, 2]) {
      let e50 = 0, eDiff = 0, eRM = 0, cover = 0; const R = 40;
      for (let r = 0; r < R; r++) {
        const logs = genLogs(a, b, n, mulberry32(mix(99, n, r, a * 100, b * 100)));
        const c = counts(logs);
        const sim = simulate({ need, c, prior, trials: 400, seed: 5 });
        const p50 = quantile(sim.do, .5);
        e50 += Math.abs(p50 - t50); eDiff += Math.abs(quantile(sim.skip, .5) - p50 - tDiff);
        eRM += Math.abs(Math.min(restartMedian(prior + c.sd, prior + c.ss), 999) - tRM);
        if (quantile(sim.do, .1) <= t50 && t50 <= quantile(sim.do, .9)) cover++;
      }
      console.log(`(${a},${b}) | ${n} | ${prior.toFixed(2)} | ${(e50 / R).toFixed(0)} | ${(eDiff / R).toFixed(1)} | ${(eRM / R).toFixed(1)} | ${(cover / R * 100).toFixed(0)}%`);
    }
  }
}

console.log('\n## 実験7: iid(0次) vs Markov(1次) のBayes因子 log10 BF(1次/0次), prior Beta(1,1)');
function logBF(c) {
  const m1 = lnB(1 + c.dd, 1 + c.ds) - lnB(1, 1) + lnB(1 + c.sd, 1 + c.ss) - lnB(1, 1);
  const nD = c.dd + c.sd, nS = c.ds + c.ss; const m0 = lnB(1 + nD, 1 + nS) - lnB(1, 1);
  return (m1 - m0) / Math.LN10;
}
for (const [a, b] of truths) for (const n of [14, 30, 60]) {
  const bfs = []; for (let r = 0; r < 200; r++) bfs.push(logBF(counts(genLogs(a, b, n, mulberry32(mix(7, n, r, a * 100, b * 100))))));
  const favor1 = bfs.filter(x => x > 0.5).length / 200, favor0 = bfs.filter(x => x < -0.5).length / 200;
  console.log(`(${a},${b}) ${n}日: 1次を支持(log10BF>0.5)=${(favor1 * 100).toFixed(0)}% / iidを支持(<-0.5)=${(favor0 * 100).toFixed(0)}% / 判断保留=${(100 - (favor1 + favor0) * 100).toFixed(0)}%`);
}

console.log('\n## 実験8: SKIPPED日の記録漏れ(確率m)による推定バイアス（60日ログ×200人, 事後平均）');
for (const [a, b] of [[0.8, 0.3], [0.6, 0.6]]) for (const m of [0, 0.3, 0.6]) {
  let sa = 0, sb = 0; const R = 200;
  for (let r = 0; r < R; r++) { const c = counts(genLogs(a, b, 60, mulberry32(mix(3, r, m * 10, a * 100)), m)); sa += (1 + c.dd) / (2 + c.dd + c.ds); sb += (1 + c.sd) / (2 + c.sd + c.ss); }
  console.log(`真(a,b)=(${a},${b}) 漏れ率${m}: 推定a=${(sa / R).toFixed(2)} 推定b=${(sb / R).toFixed(2)} → 差1/b 真=${(1 / b).toFixed(2)} 推定≈${(R / sb).toFixed(2)}`);
}
