// Fixed-size worker pool inside the same process (no new service, no API change).
import { Worker } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import type { RealInput, RealSummary } from './predict-real.ts';

type Payload = { ms: number } | { input: RealInput };
type Done = { queueWaitMs: number; real?: RealSummary };
type Job = { id: number; payload: Payload; enqueuedAt: number; resolve: (done: Done) => void; reject: (error: Error) => void };
export type WorkerReply = { id: number } & ({ ok: true; real?: RealSummary } | { ok: false; error: { name: string; message: string } });
export class PredictPoolUnavailableError extends Error {
  constructor() { super('Prediction worker pool unavailable.'); this.name = 'PredictPoolUnavailableError'; }
}

export class PredictPool {
  private idle: Worker[] = [];
  private queue: Job[] = [];
  private running = new Map<number, { job: Job; startedAt: number; worker: Worker }>();
  private nextId = 1;
  private workers: Worker[] = [];
  private unavailable: Error | undefined;
  private closing: Promise<void> | undefined;

  constructor(size: number, workerUrl = new URL('./predict-worker.ts', import.meta.url)) {
    if (!Number.isSafeInteger(size) || size < 1) throw new RangeError('Worker count must be positive');
    try {
    for (let i = 0; i < size; i++) {
      const w = new Worker(workerUrl);
      w.on('error', () => this.failClosed());
      w.on('messageerror', () => this.failClosed());
      w.on('exit', () => this.failClosed());
      w.on('message', (m: WorkerReply) => {
        if (this.unavailable) return;
        if (!m || typeof m !== 'object' || (m.ok === false && (!m.error || typeof m.error.name !== 'string' || typeof m.error.message !== 'string'))) return this.failClosed();
        const r = this.running.get(m.id);
        if (!r || r.worker !== w || typeof m.ok !== 'boolean') return this.failClosed();
        this.running.delete(m.id);
        this.idle.push(w);
        if (m.ok) r.job.resolve({ queueWaitMs: r.startedAt - r.job.enqueuedAt, real: m.real });
        else {
          const error = new Error(m.error.message);
          error.name = m.error.name;
          r.job.reject(error);
        }
        this.pump();
      });
      this.workers.push(w);
      this.idle.push(w);
    }
    } catch (error) { this.failClosed(); throw error; }
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
    if (this.unavailable) return Promise.reject(this.unavailable);
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextId++, payload, enqueuedAt: performance.now(), resolve, reject });
      this.pump();
    });
  }

  private pump() {
    while (!this.unavailable && this.idle.length && this.queue.length) {
      const worker = this.idle.pop()!;
      const job = this.queue.shift()!;
      this.running.set(job.id, { job, startedAt: performance.now(), worker });
      try { worker.postMessage({ id: job.id, ...job.payload }); }
      catch { this.failClosed(); }
    }
  }

  // Unexpected worker death / send failure rejects all running and queued jobs; no degraded pool.
  private failClosed() {
    if (this.unavailable) return;
    this.unavailable = new PredictPoolUnavailableError();
    for (const { job } of this.running.values()) job.reject(this.unavailable);
    for (const job of this.queue) job.reject(this.unavailable);
    this.running.clear();
    this.queue = [];
    this.idle = [];
    this.closing = Promise.all(this.workers.map((w) => w.terminate().catch(() => undefined))).then(() => {});
  }
  async close() { this.failClosed(); await this.closing; }
}
