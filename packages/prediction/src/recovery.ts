function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

export function recoveryQuantiles(alpha: number, beta: number): { g50: number; g80: number } {
  if (!Number.isSafeInteger(alpha) || alpha < 1 ||
      !Number.isSafeInteger(beta) || beta < 1) {
    throw new RangeError('Recovery posterior shapes must be positive safe integers');
  }
  const a = BigInt(alpha);
  const b = BigInt(beta);
  let numerator = 1n;
  let denominator = 1n;
  let g50 = 0;
  for (let t = 1; ; t++) {
    if (!Number.isSafeInteger(t)) throw new RangeError('Recovery quantile exceeds safe integer range');
    const offset = BigInt(t) - 1n;
    numerator *= b + offset;
    denominator *= a + b + offset;
    // Reduction keeps exact survival comparisons small without shifting inclusive boundaries.
    const divisor = gcd(numerator, denominator);
    numerator /= divisor;
    denominator /= divisor;
    if (g50 === 0 && 2n * numerator <= denominator) g50 = t;
    if (5n * numerator <= denominator) return { g50, g80: t };
  }
}
