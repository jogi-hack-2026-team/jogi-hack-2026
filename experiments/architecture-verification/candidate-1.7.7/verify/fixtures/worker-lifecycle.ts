import { parentPort } from 'node:worker_threads';
parentPort!.on('message', (m: { id: number; ms: number }) => {
  if (m.ms === -1) process.exit(17);
  if (m.ms === -2) throw new Error('synthetic worker error');
  if (m.ms === -3) { parentPort!.postMessage({ id: m.id, ok: false }); return; }
  // Long jobs allow close() to be tested with both running and queued work.
  setTimeout(() => parentPort!.postMessage({ id: m.id, ok: true }), Math.max(0, m.ms));
});
