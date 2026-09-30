// Fixed-size worker pool inside the same process (no new service, no API change).
import { Worker } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';

type Job = { id: number; ms: number; enqueuedAt: number; resolve: (queueWaitMs: number) => void };

export class PredictPool {
  private idle: Worker[] = [];
  private queue: Job[] = [];
  private running = new Map<number, { job: Job; startedAt: number; worker: Worker }>();
  private nextId = 1;
  private workers: Worker[] = [];

  constructor(size: number) {
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL('./predict-worker.ts', import.meta.url));
      w.on('message', (m: { id: number }) => {
        const r = this.running.get(m.id);
        if (!r) return;
        this.running.delete(m.id);
        this.idle.push(w);
        r.job.resolve(r.startedAt - r.job.enqueuedAt);
        this.pump();
      });
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  /** Resolves with the time the job waited for a free worker (ms). */
  run(ms: number): Promise<number> {
    return new Promise((resolve) => {
      this.queue.push({ id: this.nextId++, ms, enqueuedAt: performance.now(), resolve });
      this.pump();
    });
  }

  private pump() {
    while (this.idle.length && this.queue.length) {
      const worker = this.idle.pop()!;
      const job = this.queue.shift()!;
      this.running.set(job.id, { job, startedAt: performance.now(), worker });
      worker.postMessage({ id: job.id, ms: job.ms });
    }
  }

  async close() {
    await Promise.all(this.workers.map((w) => w.terminate()));
  }
}
