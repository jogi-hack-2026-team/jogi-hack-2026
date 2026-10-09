function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

/**
 * SKIPPEDから最初のDONEまでの待ち日数Gを、再開確率bの事後分布で積分した分位点。
 * g50はG自体の中央値であり、DONE開始とSKIPPED開始の完了日中央値の差ではない
 * （Architecture D-21）。完了予測のhorizonによる打切りもここには適用しない。
 */
export function recoveryQuantiles(alpha: number, beta: number): { g50: number; g80: number } {
  if (!Number.isSafeInteger(alpha) || alpha < 1 ||
      !Number.isSafeInteger(beta) || beta < 1) {
    throw new RangeError('Recovery posterior shapes must be positive safe integers');
  }
  // 入力の各形状がsafe integerでも、alpha+betaや累積積はその範囲を超えうる。
  // 浮動小数の比では閾値の直上が0.5へ丸められるため、加算・乗算の前にBigIntへ移す。
  const a = BigInt(alpha);
  const b = BigInt(beta);
  // t日後の生存確率P(G>t)=積_{i=0..t-1}(beta+i)/(alpha+beta+i)を整数比で保持する。
  // t=0ではまだ再開していない確率が1で、下のループで1日分ずつ更新する。
  let numerator = 1n;
  let denominator = 1n;
  let g50 = 0;
  for (let t = 1; ; t++) {
    if (!Number.isSafeInteger(t)) throw new RangeError('Recovery quantile exceeds safe integer range');
    const offset = BigInt(t) - 1n;
    numerator *= b + offset;
    denominator *= a + b + offset;
    // 約分して整数の桁数を抑える。生存確率の厳密な比較と、閾値への一致を含む境界は変えない。
    const divisor = gcd(numerator, denominator);
    numerator /= divisor;
    denominator /= divisor;
    // CDF=1-生存確率。g50はCDF>=0.5、g80はCDF>=0.8を満たす最小の日。
    // それぞれ生存確率<=1/2、<=1/5を交差乗算で比較し、等号の日も到達に含める。
    if (g50 === 0 && 2n * numerator <= denominator) g50 = t;
    if (5n * numerator <= denominator) return { g50, g80: t };
  }
}
