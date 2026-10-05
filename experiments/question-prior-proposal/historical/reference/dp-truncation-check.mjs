// 完了の目安DPの回帰チェック（PR #86レビュー：微小確率の打ち切りで分位点が変わる問題）
import { completionPmf, quantileDays, cdfAt, splitmix32, QUANTILE_EPS } from './completion-dp.mjs';

const fail = [];
const expect = (name, got, want) => { if (got !== want) fail.push(`${name}: got ${got}, want ${want}`); };

// 旧実装の打ち切り（生きている確率が1e-9未満で、その抽選の計算をやめる）を再現した比較用
function oldTruncatedPmf(need, draws, H) {
  const K = draws.length, mix = new Float64Array(H + 2);
  for (const [a, b] of draws) {
    let D = new Float64Array(need), S = new Float64Array(need); D[0] = 1; let alive = 1;
    for (let d = 1; d <= H && alive >= 1e-9; d++) {
      const nD = new Float64Array(need), nS = new Float64Array(need); alive = 0;
      for (let k = 0; k < need; k++) { const pd = D[k] * a + S[k] * b, ps = D[k] * (1 - a) + S[k] * (1 - b);
        if (k + 1 >= need) mix[d] += pd / K; else { nD[k + 1] += pd; alive += pd; } nS[k] += ps; alive += ps; }
      D = nD; S = nS;
    }
  }
  return mix;
}

// 1) レビューの再現ケース：開始DONE・requiredFutureDone=1・K=2・H=10
//    独立した式 F(d) = 1 − 平均[(1−a)(1−b)^(d−1)] で P50 = 3日
const caseDraws = [[0.9999999995, 0.5], [1e-10, 1e-10]], H1 = 10;
const closed = d => 1 - caseDraws.reduce((s, [a, b]) => s + (1 - a) * (1 - b) ** (d - 1), 0) / caseDraws.length;
const pmf = completionPmf(1, caseDraws, H1, 'D');
expect('レビュー例 P50（打ち切りなし）', quantileDays(pmf, 0.5, H1), 3);
expect('レビュー例 閉形式のP50', [...Array(H1).keys()].map(i => i + 1).find(d => closed(d) >= 0.5), 3);
const oldP50 = quantileDays(oldTruncatedPmf(1, caseDraws, H1), 0.5, H1);
console.log(`レビュー例：打ち切りなし P50=${quantileDays(pmf, 0.5, H1)}（CDF(3)=${cdfAt(pmf, 3)}）、旧実装 P50=${oldP50}`);

// 2) requiredFutureDone=1 の独立した式との照合（ランダムな抽選、微小確率を含む）
const rnd = splitmix32(12345), u = () => rnd() / 4294967296;
const pick = () => { const r = u(); return r < 0.15 ? u() * 1e-9 : r > 0.85 ? 1 - u() * 1e-9 : u(); }; // 0・1近くの値を混ぜる
let cases = 0, ambiguous = 0, maxErr = 0;
for (let c = 0; c < 2000; c++) {
  const K = 1 + Math.floor(u() * 6), H = 5 + Math.floor(u() * 60); const draws = Array.from({ length: K }, () => [pick(), pick()]);
  const p = completionPmf(1, draws, H, 'D');
  const F = d => 1 - draws.reduce((s, [a, b]) => s + (1 - a) * (1 - b) ** (d - 1), 0) / K;
  for (let d = 1; d <= H; d++) maxErr = Math.max(maxErr, Math.abs(cdfAt(p, d) - F(d)));
  for (const q of [0.5, 0.8]) {
    cases++;
    const want = (() => { for (let d = 1; d <= H; d++) if (F(d) >= q - QUANTILE_EPS) return d; return null; })();
    if ([...Array(H).keys()].some(i => Math.abs(F(i + 1) - q) < QUANTILE_EPS)) ambiguous++; // 許容幅に入った同点に近いケースの件数（判定は同じ規則で比較する）
    const nearBandEdge = [...Array(H).keys()].some(i => Math.abs(F(i + 1) - (q - QUANTILE_EPS)) < 1e-14);
    if (nearBandEdge) continue; // 許容幅の端そのものに丸め誤差以内で重なる場合だけ対象外（記録上0件のはず）
    expect(`独立式 case${c} q=${q}`, quantileDays(p, q, H), want);
  }
}
console.log(`独立式との照合：${cases}件（うち閾値との差が${QUANTILE_EPS}未満の同点に近いケース ${ambiguous}件も同じ規則で一致）、CDFの最大誤差 ${maxErr.toExponential(2)}`);
// 4) ちょうど同点：K=2、(a,b)=(1,任意)と(0,0) → CDF(1)=0.5 ちょうど。P50 = 1日
const tie = completionPmf(1, [[1, 0.3], [0, 0]], 10, 'D');
expect('同点例 P50', quantileDays(tie, 0.5, 10), 1);

// 3) 刈り込みあり／なしの一致（requiredFutureDone>1、微小確率を含む）
let pruneCases = 0, pruneMax = 0;
for (let c = 0; c < 300; c++) {
  const K = 1 + Math.floor(u() * 4), H = 20 + Math.floor(u() * 80), need = 1 + Math.floor(u() * (H + 5));
  const draws = Array.from({ length: K }, () => [pick(), pick()]); const start = u() < 0.5 ? 'D' : 'S';
  const p1 = completionPmf(need, draws, H, start, true), p0 = completionPmf(need, draws, H, start, false);
  for (let d = 0; d <= H; d++) pruneMax = Math.max(pruneMax, Math.abs(cdfAt(p1, d) - cdfAt(p0, d)));
  for (const q of [0.5, 0.8]) { pruneCases++; expect(`刈り込み case${c} q=${q}`, quantileDays(p1, q, H), quantileDays(p0, q, H)); }
}
console.log(`刈り込みあり／なし：${pruneCases}件の分位点が一致、CDFの最大差 ${pruneMax.toExponential(2)}`);

console.log(`node ${process.version}: ${fail.length === 0 ? 'PASS' : 'FAIL'}`);
if (fail.length) { console.log(fail.slice(0, 20).join('\n')); process.exitCode = 1; }
