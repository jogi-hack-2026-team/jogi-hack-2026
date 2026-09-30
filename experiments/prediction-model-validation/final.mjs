// 最終モデル検証: M0 / M1 / M2（使い捨て）
import { mulberry32, mix, betaSample } from './engine2.mjs';

// ---- 共通: M2 形式 (p0,p1,p2) に統一。M1は p1=p2=a, p0=b。M0は p0=p1=p2=p ----
// E[n][s]: 状態sから、あとn回DONEするまでの期待日数（無限ホライズン、厳密）
export function expectedDays(N, p0, p1, p2) {
  const ES = new Float64Array(N + 1), E1 = new Float64Array(N + 1), E2 = new Float64Array(N + 1);
  for (let n = 1; n <= N; n++) {
    ES[n] = (1 + p0 * E1[n - 1]) / p0;
    E1[n] = 1 + p1 * E2[n - 1] + (1 - p1) * ES[n];
    E2[n] = 1 + p2 * E2[n - 1] + (1 - p2) * ES[n];
  }
  return { ES, E1, E2 };
}
// ctx: 'S' | 'D1' | 'D2' = 昨日時点の状態。今日DONEなら次状態、SKIPならS
const afterDone = ctx => (ctx === 'S' ? 'D1' : 'D2');
export function delta(N, p0, p1, p2, ctx) { // E[T_skip] - E[T_done]
  const E = expectedDays(N, p0, p1, p2);
  const tDone = afterDone(ctx) === 'D1' ? E.E1[N - 1] : E.E2[N - 1];
  return { delta: E.ES[N] - tDone, tDone, tSkip: E.ES[N] };
}

// ---- 合成ログ（真のDGPはM2形式）。UNKNOWNはMCARで10% ----
function genLogs(p, n, rnd, pU = 0.1) {
  const out = []; let st = 'S';
  // burn-in 30日で定常へ
  for (let i = -30; i < n; i++) {
    const pd = st === 'S' ? p[0] : st === 'D1' ? p[1] : p[2];
    const done = rnd() < pd; st = done ? (st === 'S' ? 'D1' : 'D2') : 'S';
    if (i >= 0) out.push(done ? 'D' : 'S');
  }
  return out.map(x => (rnd() < pU ? 'U' : x));
}
// ---- 各モデルの十分統計量 ----
function countsM0(L) { let d = 0, s = 0; for (const x of L) if (x === 'D') d++; else if (x === 'S') s++; return [[d, s]]; }
function countsM1(L) { const c = [[0, 0], [0, 0]]; // [b:S起点],[a:D起点]
  for (let i = 1; i < L.length; i++) { const p = L[i - 1], q = L[i]; if (p === 'U' || q === 'U') continue; c[p === 'D' ? 1 : 0][q === 'D' ? 0 : 1]++; } return c; }
export function countsM2(L) { const c = [[0, 0], [0, 0], [0, 0]]; // [S],[D1],[D2]
  for (let i = 1; i < L.length; i++) {
    const cur = L[i - 1], nxt = L[i]; if (cur === 'U' || nxt === 'U') continue;
    let st; if (cur === 'S') st = 0; else { const prev = L[i - 2]; if (prev === undefined || prev === 'U') continue; st = prev === 'S' ? 1 : 2; }
    c[st][nxt === 'D' ? 0 : 1]++;
  } return c; }

// 事後から θ を M 回抽選し Δ(θ) の分布を得る（未来はDPで厳密、乱数はθ抽選のみ）
function posteriorDelta(model, c, prior, N, ctx, M = 1000, seed = 11) {
  const ds = [];
  for (let m = 0; m < M; m++) {
    const r = mulberry32(mix(seed, m));
    const draw = k => betaSample(prior + c[k][0], prior + c[k][1], r);
    let p0, p1, p2;
    if (model === 'M0') { p0 = p1 = p2 = draw(0); }
    else if (model === 'M1') { p0 = draw(0); p1 = p2 = draw(1); }
    else { p0 = draw(0); p1 = draw(1); p2 = draw(2); }
    ds.push(delta(N, Math.max(p0, 1e-9), p1, p2, ctx).delta);
  }
  ds.sort((x, y) => x - y);
  const q = p => ds[Math.floor(p * (M - 1))];
  return { med: q(0.5), lo: q(0.1), hi: q(0.9) };
}
function postMean(c, prior) { return c.map(([x, y]) => (prior + x) / (2 * prior + x + y)); }
function logML(c, prior) { // 周辺尤度（Beta-Bernoulli）
  const lb = (x, y) => lg(x) + lg(y) - lg(x + y);
  return c.reduce((s, [x, y]) => s + lb(prior + x, prior + y) - lb(prior, prior), 0);
}
function lg(z) { const g = 7, k = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lg(1 - z); z -= 1; let x = k[0]; for (let i = 1; i < 9; i++) x += k[i] / (z + i); const t = z + 7.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x); }

const N = 120;
const USERS = { A: [0.6, 0.6, 0.6], B: [0.3, 0.55, 0.8], C: [0.7, 0.6, 0.45], D: [0.45, 0.55, 0.65] };
const R = +process.argv[2] || 150;

if (process.argv[3] === "main") { console.log("## 0. 厳密Δ（真値） N=120");
for (const [k, p] of Object.entries(USERS)) console.log(k, p.join('/'), `ctx=S: Δ=${delta(N, ...p, 'S').delta.toFixed(2)}  ctx=D2(連続中): Δ=${delta(N, ...p, 'D2').delta.toFixed(2)}`);

// 検証: 漸化式 vs 直接シミュレーション（固定θ）
{
  const p = USERS.B, rnd = mulberry32(5); let sD = 0, sS = 0; const T = 40000;
  const sim = (st, need) => { let k = 0, d = 0; while (k < need) { d++; const pd = st === 'S' ? p[0] : st === 'D1' ? p[1] : p[2]; const x = rnd() < pd; st = x ? (st === 'S' ? 'D1' : 'D2') : 'S'; if (x) k++; } return d; };
  for (let i = 0; i < T; i++) { sD += sim('D2', N - 1); sS += sim('S', N); }
  console.log(`検算(B, ctx=D2): MC平均差=${((sS - sD) / T).toFixed(2)} 漸化式=${delta(N, ...p, 'D2').delta.toFixed(2)}`);
}}

function evaluate(prior, models, days, ctx) {
  const rows = [];
  for (const [uk, p] of Object.entries(USERS)) {
    const truth = delta(N, ...p, ctx).delta;
    for (const n of days) for (const model of models) {
      let absErr = 0, bias = 0, cover = 0, extreme = 0, width = 0, parErr = 0; const meds = [];
      let flipChange = [];
      for (let r = 0; r < R; r++) {
        const rnd = mulberry32(mix(2026, n, r, uk.charCodeAt(0)));
        const L = genLogs(p, n, rnd);
        const cnt = model === 'M0' ? countsM0(L) : model === 'M1' ? countsM1(L) : countsM2(L);
        const est = posteriorDelta(model, cnt, prior, N, ctx, 400);
        meds.push(est.med); absErr += Math.abs(est.med - truth); bias += est.med - truth; width += est.hi - est.lo;
        if (est.lo <= truth && truth <= est.hi) cover++;
        if (est.med > 2 * truth) extreme++;
        if (model === 'M2') { const pm = postMean(cnt, prior); parErr += (Math.abs(pm[0] - p[0]) + Math.abs(pm[1] - p[1]) + Math.abs(pm[2] - p[2])) / 3; }
        // 安定性: 過去の1日（末尾2日を除く既知日）を反転
        const idx = Math.floor(rnd() * Math.max(1, n - 2)); const L2 = L.slice(); if (L2[idx] !== 'U') L2[idx] = L2[idx] === 'D' ? 'S' : 'D';
        const cnt2 = model === 'M0' ? countsM0(L2) : model === 'M1' ? countsM1(L2) : countsM2(L2);
        flipChange.push(Math.abs(posteriorDelta(model, cnt2, prior, N, ctx, 400).med - est.med));
      }
      flipChange.sort((x, y) => x - y);
      rows.push({ user: uk, days: n, model, truth: truth.toFixed(2), medErr: (absErr / R).toFixed(2), bias: (bias / R).toFixed(2), cover80: `${(cover / R * 100).toFixed(0)}%`, width80: (width / R).toFixed(1), over2x: `${(extreme / R * 100).toFixed(0)}%`, flipP95: flipChange[Math.floor(0.95 * (R - 1))].toFixed(2), parMAE: model === 'M2' ? (parErr / R).toFixed(3) : '-' });
    }
  }
  return rows;
}

const mode = process.argv[3] || "none";
if (mode === 'main') {
  for (const ctx of ['D2', 'S']) {
    console.log(`\n## 1. M0/M1/M2 比較（prior Beta(1,1), ctx=${ctx}, 各${R}人）`);
    console.table(evaluate(1, ['M0', 'M1', 'M2'], [14, 30, 60], ctx));
  }
  console.log('\n## 2. モデル選択（周辺尤度最大の割合, Beta(1,1)）');
  for (const [uk, p] of Object.entries(USERS)) for (const n of [14, 30, 60]) {
    const win = { M0: 0, M1: 0, M2: 0 }; let strong = 0;
    for (let r = 0; r < R; r++) {
      const L = genLogs(p, n, mulberry32(mix(77, n, r, uk.charCodeAt(0))));
      const ml = { M0: logML(countsM0(L), 1), M1: logML(countsM1(L), 1), M2: logML(countsM2(L), 1) };
      const best = Object.entries(ml).sort((x, y) => y[1] - x[1])[0][0]; win[best]++;
      if (ml.M2 - ml.M0 > Math.log(10)) strong++;
    }
    console.log(`${uk} ${n}日: 最良 M0=${win.M0} M1=${win.M1} M2=${win.M2} / M2がM0より10倍以上支持=${(strong / R * 100).toFixed(0)}%`);
  }
} else if (mode === 'prior') {
  for (const prior of [0.5, 1, 2]) {
    console.log(`\n## 3. M2 事前感度 Beta(${prior},${prior}) ctx=D2`);
    console.table(evaluate(prior, ['M2'], [14, 30, 60], 'D2'));
  }
}
