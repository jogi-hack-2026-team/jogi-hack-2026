export const dimension = 8; // Seven percentile distances + intercept.
export type Posterior = { A: number[][]; b: number[]; evidenceCount: number };
export function prior(): Posterior {
  return {
    A: Array.from({ length: dimension }, (_, i) =>
      Array.from({ length: dimension }, (_, j) => +(i === j)),
    ),
    b: Array(dimension).fill(0),
    evidenceCount: 0,
  };
}
export function update(p: Posterior, x: number[], reward: number): void {
  if (
    x.length !== dimension ||
    !x.every(Number.isFinite) ||
    !Number.isFinite(reward)
  )
    throw new Error("invalid numeric input");
  for (let i = 0; i < dimension; i++) {
    p.b[i] += x[i] * reward;
    for (let j = 0; j < dimension; j++) p.A[i][j] += x[i] * x[j];
  }
  p.evidenceCount++;
}
function cholesky(A: number[][]): number[][] {
  const L = A.map((row) => row.map(() => 0));
  for (let i = 0; i < dimension; i++)
    for (let j = 0; j <= i; j++) {
      let value = A[i][j];
      for (let k = 0; k < j; k++) value -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(value) : value / L[j][j];
      if (!Number.isFinite(L[i][j]))
        throw new Error("posterior is not positive definite");
    }
  return L;
}
function lower(L: number[][], b: number[]): number[] {
  const x = [...b];
  for (let i = 0; i < dimension; i++) {
    for (let j = 0; j < i; j++) x[i] -= L[i][j] * x[j];
    x[i] /= L[i][i];
  }
  return x;
}
function upper(L: number[][], b: number[]): number[] {
  const x = [...b];
  for (let i = dimension - 1; i >= 0; i--) {
    for (let j = i + 1; j < dimension; j++) x[i] -= L[j][i] * x[j];
    x[i] /= L[i][i];
  }
  return x;
}
export const gaussian = () =>
  Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, Math.random()))) *
  Math.cos(2 * Math.PI * Math.random());
// sigma^2 = 1 is a PoC assumption. Covariance = A^-1, not diagonal approximation.
export function sample(p: Posterior, normal = gaussian): number[] {
  const L = cholesky(p.A),
    mean = upper(L, lower(L, p.b));
  const noise = upper(L, Array.from({ length: dimension }, normal));
  return mean.map((m, i) => m + noise[i]);
}
export const context = (candidate: number[], anchor: number[]) => [
  ...candidate.map((v, i) => Math.abs(v - anchor[i])),
  1,
];
export const dot = (a: number[], b: number[]) =>
  a.reduce((sum, x, i) => sum + x * b[i], 0);
