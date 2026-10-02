import { parentPort } from 'node:worker_threads';
import { burnCpu } from './predict-placeholder.ts';

parentPort!.on('message', (m: { id: number; ms: number }) => {
  burnCpu(m.ms);
  parentPort!.postMessage({ id: m.id });
});
