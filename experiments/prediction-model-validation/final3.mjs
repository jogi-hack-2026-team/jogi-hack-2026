// M1 中心指標(遅延Gの事後予測中央値)の prior 比較 + M1のΔ(期待値, ctx=連続中)をprior(2,2)でも評価
import { mulberry32, mix, betaSample } from './engine2.mjs';
import { delta, countsM2 } from './final.mjs';
const lg = z => { const k = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lg(1 - z); z -= 1; let x = k[0]; for (let i = 1; i < 9; i++) x += k[i] / (z + i); const t = z + 7.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x); };
const lB = (x, y) => lg(x) + lg(y) - lg(x + y);
const bgQ = (al, be, q) => { for (let t = 1; t < 1e5; t++) if (1 - Math.exp(lB(al, be + t) - lB(al, be)) >= q) return t; return Infinity; };
const USERS = { A: [0.6, 0.6, 0.6], B: [0.3, 0.55, 0.8], C: [0.7, 0.6, 0.45], D: [0.45, 0.55, 0.65] };
function genLogs(p, n, rnd, pU = 0.1) { const out = []; let st = 'S';
  for (let i = -30; i < n; i++) { const pd = st === 'S' ? p[0] : st === 'D1' ? p[1] : p[2]; const d = rnd() < pd; st = d ? (st === 'S' ? 'D1' : 'D2') : 'S'; if (i >= 0) out.push(d ? 'D' : 'S'); }
  return out.map(x => (rnd() < pU ? 'U' : x)); }
console.log('user | 日数 | prior | G中央値 真値 | MAE | 過大(>真値+1日) | 80%上限の被覆 | M1 Δ(ctx連続中) MAE / 2倍超');
for (const [uk, p] of Object.entries(USERS)) for (const n of [14, 30, 60]) for (const pr of [1, 2]) {
  const tMed = Math.max(1, Math.ceil(Math.log(0.5) / Math.log(1 - p[0]))), tD = delta(120, ...p, 'D2').delta;
  let mae = 0, over = 0, cov = 0, dErr = 0, d2x = 0; const R = 200;
  for (let r = 0; r < R; r++) {
    const c = countsM2(genLogs(p, n, mulberry32(mix(51, n, r, uk.charCodeAt(0)))));
    const al = pr + c[0][0], be = pr + c[0][1]; const med = bgQ(al, be, 0.5), q80 = bgQ(al, be, 0.8);
    mae += Math.abs(med - tMed); if (med > tMed + 1) over++;
    // 真のGの80%点以下に実際のGが入る確率 = 真の P(G <= q80)
    cov += 1 - Math.pow(1 - p[0], q80);
    const ds = []; for (let m = 0; m < 300; m++) { const rr = mulberry32(mix(9, m)); const b = betaSample(al, be, rr); const a = betaSample(pr + c[1][0] + c[2][0], pr + c[1][1] + c[2][1], rr); ds.push(delta(120, Math.max(b, 1e-9), a, a, 'D2').delta); }
    ds.sort((x, y) => x - y); const dm = ds[150]; dErr += Math.abs(dm - tD); if (dm > 2 * tD) d2x++;
  }
  console.log(`${uk} | ${n} | Beta(${pr},${pr}) | ${tMed} | ${(mae / R).toFixed(2)} | ${(over / R * 100).toFixed(0)}% | ${(cov / R * 100).toFixed(0)}% | ${(dErr / R).toFixed(2)} / ${(d2x / R * 100).toFixed(0)}%`);
}
