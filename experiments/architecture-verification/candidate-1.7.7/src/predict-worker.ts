import { parentPort } from 'node:worker_threads';
import { burnCpu } from './predict-placeholder.ts';
import type { RealInput } from './predict-real.ts';
import type { WorkerReply } from './predict-pool.ts';

// Loaded on the first real job only, so placeholder runs do not need the engine build.
let real: typeof import('./predict-real.ts') | undefined;

parentPort!.on('message', async (m: { id: number; ms?: number; input?: RealInput }) => {
  let reply: WorkerReply;
  try {
    if (m.input) {
      real ??= await import('./predict-real.ts');
      reply = { id: m.id, ok: true, real: real.runReal(m.input) };
    } else {
      burnCpu(m.ms ?? 0);
      reply = { id: m.id, ok: true };
    }
  } catch (error) {
    reply = { id: m.id, ok: false, error: { name: error instanceof Error ? error.name : 'Error', message: 'Prediction job failed.' } };
  }
  parentPort!.postMessage(reply);
});
