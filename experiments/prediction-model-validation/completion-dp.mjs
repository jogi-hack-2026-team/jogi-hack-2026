// 完了の目安のDP（Architecture「手順5」「乱数とサンプラーの仕様」の参照実装。使い捨ての検証用）
// 確率の大きさによる打ち切りはしない。計算を省くのは、残り日数で届かない状態（H日以内の累積確率に影響しない）と、
// 生きている状態が無くなった後だけ。微小確率の打ち切りは分位点を変えうる（PR #86レビュー）
export const fmix32 = h => { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; };
export const seedFor = (seed, m) => fmix32((seed ^ Math.imul(m + 1, 0x9e3779b9)) >>> 0);
export function splitmix32(s) {
  let state = s >>> 0;
  return () => { state = (state + 0x9e3779b9) >>> 0; let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad); z = Math.imul(z ^ (z >>> 15), 0x735a2d97); z ^= z >>> 15; return z >>> 0; };
}
const uniform = next => (next() + 0.5) / 4294967296;
const normal = next => Math.sqrt(-2 * Math.log(uniform(next))) * Math.cos(2 * Math.PI * uniform(next));
function gamma(alpha, next) {
  const d = alpha - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) { let x, v; do { x = normal(next); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = uniform(next);
    if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v; }
}
export const beta = (a, b, next) => { const x = gamma(a, next); return x / (x + gamma(b, next)); };

export function drawsFromPosterior(post, K, seed = 20261012) {
  const out = [];
  for (let m = 0; m < K; m++) { const n = splitmix32(seedFor(seed, m)); const a = beta(post.a[0], post.a[1], n); out.push([a, beta(post.b[0], post.b[1], n)]); }
  return out;
}

// draws: [[a,b], ...]（等重み）。start: 'D' | 'S'。need = requiredFutureDone。返り値は到達日の混合pmf（index H+1 = H日以内に未到達）
// prune=true：残り日数で届かない状態を計算しない（厳密）。prune=false：全状態を計算する（照合用）
export function completionPmf(need, draws, H, start = 'D', prune = true) {
  const K = draws.length, mix = new Float64Array(H + 2);
  if (need <= 0) { mix[0] = 1; return mix; }
  if (need > H) { mix[H + 1] = 1; return mix; }
  let D = new Float64Array(need), S = new Float64Array(need), nD = new Float64Array(need), nS = new Float64Array(need);
  for (const [a, b] of draws) {
    D.fill(0); S.fill(0); (start === 'D' ? D : S)[0] = 1; let lo = 0, hi = 0; let reached = 0;
    for (let d = 1; d <= H; d++) {
      const kmin = prune ? Math.max(lo, need - (H - d + 1)) : lo; // d日目以降の残り日数で need に届かない k は除く
      if (kmin > hi) break; // 生きている状態が無い（打ち切りではなく、以後の到達確率が厳密に0）
      const top = Math.min(hi + 1, need - 1);
      nD.fill(0, kmin, top + 1); nS.fill(0, kmin, top + 1);
      for (let k = kmin; k <= hi; k++) {
        const dk = D[k], sk = S[k]; const pd = dk * a + sk * b, ps = dk * (1 - a) + sk * (1 - b);
        if (k + 1 >= need) { mix[d] += pd / K; reached += pd; } else nD[k + 1] += pd;
        nS[k] += ps;
      }
      [D, nD] = [nD, D]; [S, nS] = [nS, S]; lo = kmin; hi = top;
    }
    mix[H + 1] += Math.max(0, 1 - reached) / K;
  }
  return mix;
}
// 分位点：CDF ≥ q − QUANTILE_EPS を満たす最小の日。浮動小数点の丸め誤差（実測で最大約3e-15）でCDFがちょうど閾値の
// 場合に1日遅れないよう、許容幅を設けて「閾値に一致する日も到達」とする（中心指標と同じ扱い）
export const QUANTILE_EPS = 1e-12;
export function quantileDays(mix, q, H) { let c = 0; for (let d = 0; d <= H; d++) { c += mix[d]; if (c >= q - QUANTILE_EPS) return d; } return null; }
export function cdfAt(mix, d) { let c = 0; for (let i = 0; i <= d; i++) c += mix[i]; return c; }
