import type { PosteriorSample } from './random.js';

export interface CompletionParameters {
  initialState: 'DONE' | 'SKIPPED';
  requiredFutureDone: number;
  horizonDays: number;
  a: number;
  b: number;
  prune?: boolean;
}

/** 将来の各日を添字として、その日に初めて必要DONE回数へ到達する確率を返す。上限日数より先の確率を除いて再正規化しない。 */
export function completionPmf({ initialState, requiredFutureDone: n, horizonDays: h, a, b, prune = true }: CompletionParameters): Float64Array {
  const pmf = new Float64Array(h + 1);
  if (n === 0) { pmf[0] = 1; return pmf; }
  if (n > h) return pmf;
  let done = new Float64Array(n);
  let skipped = new Float64Array(n);
  let nextDone = new Float64Array(n);
  let nextSkipped = new Float64Array(n);
  if (initialState === 'DONE') done[0] = 1;
  else skipped[0] = 1;
  // n=hかつprune時はlow=high=day-1。次の日に読むDONE[day]は下の遷移で上書きする。
  // SKIPPED[day]には届かないため0にし、それより前のセルは今後読まない。
  const deadlineOnly = prune && n === h;
  for (let day = 1; day <= h; day++) {
    if (deadlineOnly) {
      nextDone[0] = 0;
      if (day < n) nextSkipped[day] = 0;
    } else {
      nextDone.fill(0);
      nextSkipped.fill(0);
    }
    // 残りの日をすべてDONEにしても必要回数nへ届かない状態だけを除く。小さな確率は切り捨てない。
    const low = prune ? Math.max(0, n - (h - day + 1)) : 0;
    const high = Math.min(n - 1, day - 1);
    for (let count = low; count <= high; count++) {
      const doneMass = done[count]! * a + skipped[count]! * b;
      if (count + 1 === n) pmf[day] = pmf[day]! + doneMass;
      else nextDone[count + 1] = doneMass;
      nextSkipped[count] = done[count]! * (1 - a) + skipped[count]! * (1 - b);
    }
    [done, nextDone] = [nextDone, done];
    [skipped, nextSkipped] = [nextSkipped, skipped];
  }
  return pmf;
}

export function mixtureCompletionQuantiles(samples: readonly PosteriorSample[], initialState: 'DONE' | 'SKIPPED', requiredFutureDone: number, horizonDays: number): { p50Days: number | null; p80Days: number | null } {
  if (requiredFutureDone === 0) return { p50Days: 0, p80Days: 0 };
  if (requiredFutureDone > horizonDays) return { p50Days: null, p80Days: null };
  const mixture = new Float64Array(horizonDays + 1);
  for (const { a, b } of samples) {
    const pmf = completionPmf({ initialState, requiredFutureDone, horizonDays, a, b });
    for (let day = 1; day <= horizonDays; day++) mixture[day] = mixture[day]! + pmf[day]! / samples.length;
  }
  let cdf = 0;
  let p50Days: number | null = null;
  for (let day = 1; day <= horizonDays; day++) {
    cdf += mixture[day]!;
    if (p50Days === null && cdf >= 0.5 - 1e-12) p50Days = day;
    if (cdf >= 0.8 - 1e-12) return { p50Days, p80Days: day };
  }
  return { p50Days, p80Days: null };
}
