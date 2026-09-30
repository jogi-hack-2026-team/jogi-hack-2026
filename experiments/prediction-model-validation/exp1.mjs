// 実験1: MC vs 厳密DP（a,b固定） / 実験2: CRNの分散削減 / 実験3: 実行時間 / 実験4: 不確実性の内訳
import { simulate, quantile, exactDP, pmfQuantile, probBy } from './engine2.mjs';

const need = 120; // 例: 30分×120回 = 60時間
console.log('## 実験1: a,b固定で MC(2000) と 厳密DP の比較');
for (const [a, b] of [[0.8, 0.3], [0.6, 0.6], [0.5, 0.2], [0.9, 0.7]]) {
  const mc = simulate({ need, c: null, fixedAB: [a, b], seed: 7 });
  const row = [];
  for (const scen of ['do', 'skip']) {
    const pmf = exactDP(need, scen === 'do', a, b);
    row.push(`${scen}: P50 MC=${quantile(mc[scen], .5)} DP=${pmfQuantile(pmf, .5)}, P80 MC=${quantile(mc[scen], .8)} DP=${pmfQuantile(pmf, .8)}`);
  }
  const dDo = exactDP(need, true, a, b), dSk = exactDP(need, false, a, b);
  const mean = p => p.reduce((s, x, i) => s + x * i, 0);
  const pi = b / (1 - a + b), mult = 1 / (1 - (a - b));
  console.log(`a=${a} b=${b} | ${row.join(' | ')} | 平均差DP=${(mean(dSk) - mean(dDo)).toFixed(2)}日 解析近似=${(mult / pi).toFixed(2)}日`);
}

console.log('\n## 実験2: CRN vs 独立乱数での「P50差」のばらつき（seedを50通り）');
const c30 = { dd: 12, ds: 5, sd: 5, ss: 7 }; // 30日程度のログ相当
for (const crn of [true, false]) {
  const diffs = [];
  for (let s = 1; s <= 50; s++) { const r = simulate({ need, c: c30, seed: s, crn }); diffs.push(quantile(r.skip, .5) - quantile(r.do, .5)); }
  const m = diffs.reduce((x, y) => x + y) / diffs.length, sd = Math.sqrt(diffs.reduce((x, y) => x + (y - m) ** 2, 0) / (diffs.length - 1));
  console.log(`${crn ? 'CRN ' : '独立'}: 平均=${m.toFixed(2)}日 SD=${sd.toFixed(2)}日 範囲=[${Math.min(...diffs)}, ${Math.max(...diffs)}] 負になった回数=${diffs.filter(d => d < 0).length}`);
}

console.log('\n## 実験3: 実行時間（2000 trials×2シナリオ）');
for (const [label, c] of [['ログ30日', c30], ['ログ3日', { dd: 1, ds: 0, sd: 1, ss: 0 }]]) {
  const t0 = performance.now(); simulate({ need, c, seed: 1 }); console.log(`${label}: ${(performance.now() - t0).toFixed(0)} ms`);
}
{ const t0 = performance.now(); exactDP(need, true, .7, .4); console.log(`DP 1回(a,b固定): ${(performance.now() - t0).toFixed(1)} ms`); }

console.log('\n## 実験4: 予測幅(P80-P50)のうち、パラメータ不確実性と将来の確率変動の寄与');
for (const [label, c] of [['3日', { dd: 1, ds: 0, sd: 1, ss: 0 }], ['30日', c30], ['60日', { dd: 24, ds: 10, sd: 10, ss: 15 }], ['180日', { dd: 72, ds: 30, sd: 30, ss: 47 }]]) {
  const r = simulate({ need, c, seed: 3 });
  const aHat = (1 + c.dd) / (2 + c.dd + c.ds), bHat = (1 + c.sd) / (2 + c.sd + c.ss);
  const pmf = exactDP(need, true, aHat, bHat);
  console.log(`${label}: 事後込み P50=${quantile(r.do, .5)} P80=${quantile(r.do, .8)} (幅${quantile(r.do, .8) - quantile(r.do, .5)}) | 事後平均で固定 P50=${pmfQuantile(pmf, .5)} P80=${pmfQuantile(pmf, .8)} (幅${pmfQuantile(pmf, .8) - pmfQuantile(pmf, .5)}) | 3年未到達率=${(1 - probBy(r.do, 1095)).toFixed(3)}`);
}
