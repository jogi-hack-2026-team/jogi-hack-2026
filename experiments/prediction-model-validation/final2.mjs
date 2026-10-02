// 最終検証 追補: 同一観測でのモデル選択 / 漸化式の厳密性 / 中心指標 / 実行時間
import { mulberry32, mix, betaSample } from './engine2.mjs';
import { delta, countsM2 } from './final.mjs';
import { completionPmf, quantileDays } from './completion-dp.mjs';

const lg = z => { const k = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lg(1 - z); z -= 1; let x = k[0]; for (let i = 1; i < 9; i++) x += k[i] / (z + i); const t = z + 7.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x); };
const lB = (x, y) => lg(x) + lg(y) - lg(x + y);
const USERS = { A: [0.6, 0.6, 0.6], B: [0.3, 0.55, 0.8], C: [0.7, 0.6, 0.45], D: [0.45, 0.55, 0.65] };
function genLogs(p, n, rnd, pU = 0.1) { const out = []; let st = 'S';
  for (let i = -30; i < n; i++) { const pd = st === 'S' ? p[0] : st === 'D1' ? p[1] : p[2]; const d = rnd() < pd; st = d ? (st === 'S' ? 'D1' : 'D2') : 'S'; if (i >= 0) out.push(d ? 'D' : 'S'); }
  return out.map(x => (rnd() < pU ? 'U' : x)); }

// 1) 同一観測集合（M2で状態が定まる遷移）での周辺尤度比較
console.log('## 1. 同一観測でのモデル選択（Beta(1,1)、各300人）: 事後確率が0.9超で選ばれた割合');
for (const [uk, p] of Object.entries(USERS)) {
  const line = [];
  for (const n of [14, 30, 60]) {
    const pick = { M0: 0, M1: 0, M2: 0, 保留: 0 };
    for (let r = 0; r < 300; r++) {
      const c = countsM2(genLogs(p, n, mulberry32(mix(31, n, r, uk.charCodeAt(0)))));
      const ml0 = lB(1 + c[0][0] + c[1][0] + c[2][0], 1 + c[0][1] + c[1][1] + c[2][1]) - lB(1, 1);
      const ml1 = lB(1 + c[0][0], 1 + c[0][1]) + lB(1 + c[1][0] + c[2][0], 1 + c[1][1] + c[2][1]) - 2 * lB(1, 1);
      const ml2 = lB(1 + c[0][0], 1 + c[0][1]) + lB(1 + c[1][0], 1 + c[1][1]) + lB(1 + c[2][0], 1 + c[2][1]) - 3 * lB(1, 1);
      const m = Math.max(ml0, ml1, ml2), w = [ml0, ml1, ml2].map(x => Math.exp(x - m)), s = w[0] + w[1] + w[2];
      const post = w.map(x => x / s), i = post.findIndex(x => x > 0.9);
      if (i < 0) pick.保留++; else pick[['M0', 'M1', 'M2'][i]]++;
    }
    line.push(`${n}日 M0:${(pick.M0 / 3).toFixed(0)}% M1:${(pick.M1 / 3).toFixed(0)}% M2:${(pick.M2 / 3).toFixed(0)}% 保留:${(pick.保留 / 3).toFixed(0)}%`);
  }
  console.log(uk, USERS[uk].join('/'), '|', line.join(' | '));
}

// 2) 漸化式の厳密性: 到達日pmfのDP（長ホライズン）の平均差と比較
function pmfDP(N, p, start, H = 4000) { // start: {state, k}
  let D = { S: new Float64Array(N), D1: new Float64Array(N), D2: new Float64Array(N) }; D[start.state][start.k] = 1;
  let mean = 0, mass = 0; if (start.k >= N) return 0;
  for (let d = 1; d <= H; d++) { const n = { S: new Float64Array(N), D1: new Float64Array(N), D2: new Float64Array(N) };
    for (const [st, pd] of [['S', p[0]], ['D1', p[1]], ['D2', p[2]]]) for (let k = 0; k < N; k++) { const m = D[st][k]; if (!m) continue;
      const nx = st === 'S' ? 'D1' : 'D2'; if (k + 1 >= N) { mean += d * m * pd; mass += m * pd; } else n[nx][k + 1] += m * pd; n.S[k] += m * (1 - pd); }
    D = n; if (1 - mass < 1e-13) break; } // 期待値の照合用。残り1e-13未満で止める（分位点には使わない。平均への影響は最大でも 4000日×1e-13）
  return mean; }
console.log('\n## 2. 漸化式Δ vs 到達日pmf DPの平均差（N=120, ctx=連続中）');
for (const [uk, p] of Object.entries(USERS)) { const viaPmf = pmfDP(120, p, { state: 'S', k: 0 }) - pmfDP(120, p, { state: 'D2', k: 1 });
  console.log(uk, `漸化式=${delta(120, ...p, 'D2').delta.toFixed(6)} pmfDP=${viaPmf.toFixed(6)}`); }

// 3) 中心指標の候補（M1, ctx=昨日DONE）: 同じ30日ログ系列での安定性
// G = 遅延日数（M1ではT_skip = T_done + G, G~Geom(b) が厳密）→ 事後予測は Beta-Geometric
// 分位点は厳密に評価する：P(G>t) = Π_{i<t} (β+i)/(α+β+i) をBigIntの有理数で持ち、
// CDF ≥ q を「10·N ≤ (10−10q)·D」で判定する（α・βは整数、qは0.1刻み）。
// lBの差のexpによる浮動小数点の計算は、CDFが閾値に一致する境界で1日ずれた（PR #86レビュー）
const bgQ = (al, be, q) => {
  if (!Number.isInteger(al) || !Number.isInteger(be)) throw new Error('bgQ requires integer alpha/beta');
  const qn = BigInt(Math.round(q * 10)), A = BigInt(al), B = BigInt(be); let N = 1n, D = 1n;
  for (let t = 1; t < 100000; t++) { const i = BigInt(t - 1); N *= B + i; D *= A + B + i; if (10n * N <= (10n - qn) * D) return t; }
  return Infinity;
};
console.log('\n## 3. 中心指標候補の比較（M1、各300人）');
console.log('user | 日数 | 指標 | 真値 | 平均絶対誤差 | 1日反転時の変化P95 | 無限大/発散の割合');
for (const [uk, p] of Object.entries(USERS)) for (const n of [14, 30, 60]) {
  const res = { 'G中央値(Beta-Geom)': [], 'E[G]=E[1/b]': [], 'P50差(MC 2000)': [] }; const flips = { 'G中央値(Beta-Geom)': [], 'E[G]=E[1/b]': [], 'P50差(MC 2000)': [] };
  const truthMed = Math.max(1, Math.ceil(Math.log(0.5) / Math.log(1 - p[0]))), truthMean = 1 / p[0];
  for (let r = 0; r < 300; r++) {
    const rnd = mulberry32(mix(41, n, r, uk.charCodeAt(0))); const L = genLogs(p, n, rnd);
    const calc = L => { const c = countsM2(L); const al = 1 + c[0][0], be = 1 + c[0][1];
      return { 'G中央値(Beta-Geom)': bgQ(al, be, 0.5), 'E[G]=E[1/b]': al > 1 ? (al + be - 1) / (al - 1) : Infinity }; };
    const v = calc(L); const idx = Math.floor(rnd() * (n - 2)); const L2 = L.slice(); if (L2[idx] !== 'U') L2[idx] = L2[idx] === 'D' ? 'S' : 'D'; const v2 = calc(L2);
    for (const k of Object.keys(v)) { res[k].push(v[k]); flips[k].push(Math.abs(v2[k] - v[k])); }
  }
  for (const k of ['G中央値(Beta-Geom)', 'E[G]=E[1/b]']) { const t = k.startsWith('G中央値') ? truthMed : truthMean;
    const fin = res[k].filter(Number.isFinite); const f = flips[k].filter(Number.isFinite).sort((x, y) => x - y);
    console.log(`${uk} | ${n} | ${k} | ${t.toFixed(2)} | ${(fin.reduce((s, x) => s + Math.abs(x - t), 0) / fin.length).toFixed(2)} | ${f[Math.floor(0.95 * (f.length - 1))].toFixed(2)} | ${((300 - fin.length) / 3).toFixed(0)}%`); }
}

// 4) 補助指標（完了見込み）の実行時間: θ抽選K回×到達日pmf DP（微小確率の打ち切りなし。PR #86レビュー）
// N回のうち今日の1回は実績に含め、DPは残り N−1 回（requiredFutureDone）から始める
function completionMixture(N, c, K = 200, seed = 20261012, H = 1095) {
  const draws = [];
  for (let m = 0; m < K; m++) { const r = mulberry32(mix(seed, m)); const a = betaSample(1 + c.dd, 1 + c.ds, r); draws.push([a, betaSample(1 + c.sd, 1 + c.ss, r)]); }
  return completionPmf(N - 1, draws, H, 'D');
}
console.log('\n## 4. 補助指標の計算時間（今日DONEの完了見込み分布, N=120）');
for (const K of [200, 500]) { const t0 = performance.now(); const pmf = completionMixture(120, { dd: 12, ds: 5, sd: 5, ss: 7 }, K);
  console.log(`K=${K}: ${(performance.now() - t0).toFixed(0)} ms, P50=${quantileDays(pmf, 0.5, 1095)}日 P80=${quantileDays(pmf, 0.8, 1095)}日`); }
{ const a = []; for (const s of [1, 2, 3, 4, 5]) a.push(quantileDays(completionMixture(120, { dd: 12, ds: 5, sd: 5, ss: 7 }, 200, s), 0.5, 1095));
  console.log(`K=200 のseed違い5回でのP50: ${a.join(', ')}`); }
