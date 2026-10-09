import type { PosteriorSample } from './random.js';

export interface CompletionParameters {
  initialState: 'DONE' | 'SKIPPED';
  requiredFutureDone: number;
  horizonDays: number;
  a: number;
  b: number;
  prune?: boolean;
}

/**
 * 明日を1日目として、将来n回目のDONEに初めて到達する日の確率pmf[day]を返す。
 * aはDONE翌日のDONE確率、bはSKIPPED翌日のDONE確率で、この呼び出し中は固定する。
 * pmf[0]は計算開始時点で必要回数が0の場合だけ1。h日目までの未到達分はpmfへ入れず、
 * 到達した分だけで再正規化しないため、pmfの総和は1未満になりうる。
 */
export function completionPmf({ initialState, requiredFutureDone: n, horizonDays: h, a, b, prune = true }: CompletionParameters): Float64Array {
  const pmf = new Float64Array(h + 1);
  if (n === 0) { pmf[0] = 1; return pmf; }
  if (n > h) return pmf;
  // day日の遷移前に読むdone[count] / skipped[count]は、day-1日後の状態と
  // 将来DONE累計countにある未到達経路の確率質量。count<nのセルだけを持つ。
  // 今日のDONEはinitialStateに反映済みで、将来回数の添字は0から始める。
  let done = new Float64Array(n);
  let skipped = new Float64Array(n);
  let nextDone = new Float64Array(n);
  let nextSkipped = new Float64Array(n);
  if (initialState === 'DONE') done[0] = 1;
  else skipped[0] = 1;
  // n=hでは全日DONEの経路だけが期限内に届き、prune時の読取範囲はcount=day-1だけ。
  // 2組の配列を交換して再利用する。day<nなら次の日に読むdone[day]を下で上書きする。
  // skipped[day]は遷移先にならないので0にする。範囲外の古いセルは今後読まない。
  const deadlineOnly = prune && n === h;
  for (let day = 1; day <= h; day++) {
    if (deadlineOnly) {
      nextDone[0] = 0;
      if (day < n) nextSkipped[day] = 0;
    } else {
      nextDone.fill(0);
      nextSkipped.fill(0);
    }
    // day日目の遷移前なので残りはその日を含むh-day+1日。low未満は全日DONEでも
    // nへ届かず、highより上は前日までに生じないか到達済み。期限内の初到達確率を
    // 変えない範囲だけを読む。除いた未到達分を再配分せず、小さな確率も切り捨てない。
    const low = prune ? Math.max(0, n - (h - day + 1)) : 0;
    const high = Math.min(n - 1, day - 1);
    for (let count = low; count <= high; count++) {
      const doneMass = done[count]! * a + skipped[count]! * b;
      // n回目のDONEはここで吸収し、初到達日のpmfへ移す。翌日の未到達状態へは
      // 戻さないので、同じ経路が複数の到達日に数えられることはない。
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
  // 各事後サンプルの初到達分布を等重みで混合する。分位点同士を平均する処理ではない。
  const mixture = new Float64Array(horizonDays + 1);
  for (const { a, b } of samples) {
    const pmf = completionPmf({ initialState, requiredFutureDone, horizonDays, a, b });
    for (let day = 1; day <= horizonDays; day++) mixture[day] = mixture[day]! + pmf[day]! / samples.length;
  }
  // 尾を除いて再正規化せず、元の分布のCDFで判定する。epsilon=1e-12は丸めの許容幅で、
  // 確率質量の刈込みには使わない。horizonDaysまでに閾値へ届かなければnullのまま。
  // P50だけ求まりP80がnullの場合もあり、nullから将来の到達不能までは断定しない。
  let cdf = 0;
  let p50Days: number | null = null;
  for (let day = 1; day <= horizonDays; day++) {
    cdf += mixture[day]!;
    if (p50Days === null && cdf >= 0.5 - 1e-12) p50Days = day;
    if (cdf >= 0.8 - 1e-12) return { p50Days, p80Days: day };
  }
  return { p50Days, p80Days: null };
}
