import { parentPort } from 'node:worker_threads';
import { burnCpu } from './predict-placeholder.ts';
import type { RealInput } from './predict-real.ts';

// Loaded on the first real job only, so placeholder runs do not need the engine build.
let real: typeof import('./predict-real.ts') | undefined;

parentPort!.on('message', async (m: { id: number; ms?: number; input?: RealInput }) => {
  if (m.input) {
    real ??= await import('./predict-real.ts');
    parentPort!.postMessage({ id: m.id, real: real.runReal(m.input) });
    return;
  }
  burnCpu(m.ms ?? 0);
  parentPort!.postMessage({ id: m.id });
});
