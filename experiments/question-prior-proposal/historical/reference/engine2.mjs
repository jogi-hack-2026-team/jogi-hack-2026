// 検証用エンジン v2（使い捨て）。単位は「セッション数」。
export const HORIZON = 365 * 3;

export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function mix(...xs) {
  let h = 2166136261;
  for (const x of xs) { h ^= x >>> 0; h = Math.imul(h, 16777619); h ^= h >>> 13; }
  return h >>> 0;
}
function gamma(k, rnd) {
  if (k < 1) return gamma(k + 1, rnd) * Math.pow(rnd(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do { const u1 = rnd() || 1e-12, u2 = rnd(); x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); v = 1 + c * x; } while (v <= 0);
    v = v * v * v; const u = rnd() || 1e-12;
    if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
  }
}
export const betaSample = (a, b, rnd) => { const x = gamma(a, rnd); return x / (x + gamma(b, rnd)); };

export function counts(logs) {
  const c = { dd: 0, ds: 0, sd: 0, ss: 0 };
  for (let i = 1; i < logs.length; i++) {
    const p = logs[i - 1], q = logs[i];
    if (p === 'U' || q === 'U') continue;
    c[(p === 'D' ? 'd' : 's') + (q === 'D' ? 'd' : 's')]++;
  }
  return c;
}

// 1 trial の到達日（今日=0日目）。u(day) は日ごとの一様乱数
function reachDay(need, todayDone, a, b, u, horizon) {
  if (need <= 0) return 0;
  let acc = todayDone ? 1 : 0, state = todayDone;
  if (acc >= need) return 0;
  for (let day = 1; day <= horizon; day++) {
    state = u(day) < (state ? a : b);
    if (state && ++acc >= need) return day;
  }
  return Infinity;
}

// crn=false のときは「やる」「やらない」で別の乱数列（比較用）
export function simulate({ need, c, prior = 1, trials = 2000, seed = 1, horizon = HORIZON, crn = true, fixedAB }) {
  const out = { do: new Float64Array(trials), skip: new Float64Array(trials), a: [], b: [] };
  for (let t = 0; t < trials; t++) {
    const pr = mulberry32(mix(seed, t, 1));
    const a = fixedAB ? fixedAB[0] : betaSample(prior + c.dd, prior + c.ds, pr);
    const b = fixedAB ? fixedAB[1] : betaSample(prior + c.sd, prior + c.ss, pr);
    out.a.push(a); out.b.push(b);
    for (const scen of ['do', 'skip']) {
      const purpose = crn ? 2 : (scen === 'do' ? 2 : 3);
      const r = mulberry32(mix(seed, t, purpose));
      const buf = []; const u = d => { while (buf.length < d) buf.push(r()); return buf[d - 1]; };
      out[scen][t] = reachDay(need, scen === 'do', a, b, u, horizon);
    }
  }
  return out;
}
export function quantile(arr, p) { const s = Float64Array.from(arr).sort(); return s[Math.ceil(p * s.length) - 1]; }
export const probBy = (arr, day) => arr.filter(x => x <= day).length / arr.length;

// 厳密解: a,b 固定での到達日分布（動的計画法）。戻り値 pmf[day]、残りは未到達
export function exactDP(need, todayDone, a, b, horizon = HORIZON) {
  const pmf = new Float64Array(horizon + 1);
  if (need <= 0) { pmf[0] = 1; return pmf; }
  let k0 = todayDone ? 1 : 0;
  if (k0 >= need) { pmf[0] = 1; return pmf; }
  let D = new Float64Array(need), S = new Float64Array(need); // 状態×累積回数
  (todayDone ? D : S)[k0] = 1;
  for (let day = 1; day <= horizon; day++) {
    const nD = new Float64Array(need), nS = new Float64Array(need);
    for (let k = 0; k < need; k++) {
      const pd = D[k] * a + S[k] * b, ps = D[k] * (1 - a) + S[k] * (1 - b);
      if (k + 1 >= need) pmf[day] += pd; else nD[k + 1] += pd;
      nS[k] += ps;
    }
    D = nD; S = nS;
  }
  return pmf;
}
export function pmfQuantile(pmf, p) { let c = 0; for (let d = 0; d < pmf.length; d++) { c += pmf[d]; if (c >= p - 1e-12) return d; } return Infinity; }
