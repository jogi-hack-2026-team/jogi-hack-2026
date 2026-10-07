// Fixed-size worker pool inside the same process (no new service, no API change).
import { Worker } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import type { RealInput, RealSummary } from './predict-real.ts';

type Payload = { ms: number } | { input: RealInput };
type Done = { queueWaitMs: number; real?: RealSummary };
type Job = { id: number; payload: Payload; enqueuedAt: number; resolve: (done: Done) => void };

export class PredictPool {
  private idle: Worker[] = [];
  private queue: Job[] = [];
  private running = new Map<number, { job: Job; startedAt: number; worker: Worker }>();
  private nextId = 1;
  private workers: Worker[] = [];

  constructor(size: number) {
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL('./predict-worker.ts', import.meta.url));
      w.on('message', (m: { id: number; real?: RealSummary }) => {
        const r = this.running.get(m.id);
        if (!r) return;
        this.running.delete(m.id);
        this.idle.push(w);
        r.job.resolve({ queueWaitMs: r.startedAt - r.job.enqueuedAt, real: m.real });
        this.pump();
      });
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  /** Resolves with the time the job waited for a free worker (ms). */
  async run(ms: number): Promise<number> {
    return (await this.enqueue({ ms })).queueWaitMs;
  }

  /** Runs the real engine in a worker. Resolves with the queue wait and the engine summary. */
  async runReal(input: RealInput): Promise<{ queueWaitMs: number; real: RealSummary }> {
    const done = await this.enqueue({ input });
    if (!done.real) throw new Error('worker returned no engine result');
    return { queueWaitMs: done.queueWaitMs, real: done.real };
  }

  private enqueue(payload: Payload): Promise<Done> {
    return new Promise((resolve) => {
      this.queue.push({ id: this.nextId++, payload, enqueuedAt: performance.now(), resolve });
      this.pump();
    });
  }

  private pump() {
    while (this.idle.length && this.queue.length) {
      const worker = this.idle.pop()!;
      const job = this.queue.shift()!;
      this.running.set(job.id, { job, startedAt: performance.now(), worker });
      worker.postMessage({ id: job.id, ...job.payload });
    }
  }

  async close() {
    await Promise.all(this.workers.map((w) => w.terminate()));
  }
}
