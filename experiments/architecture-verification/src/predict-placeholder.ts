// Supporting Artifact / Not a Source of Truth (Issue #84).
// NOT the prediction engine. The engine (#71/#72) does not exist yet. This burns CPU
// synchronously for a requested duration so that the *service* can be observed under a
// given compute budget. It is never evidence for T-14.
import { performance } from 'node:perf_hooks';

export function burnCpu(ms: number): number {
  if (ms <= 0) return 0;
  const end = performance.now() + ms;
  let x = 0;
  while (performance.now() < end) {
    for (let i = 1; i < 2000; i++) x += Math.sqrt(i) / i;
  }
  return x;
}
