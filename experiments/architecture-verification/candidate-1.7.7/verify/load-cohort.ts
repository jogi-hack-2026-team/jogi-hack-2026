// Each phase owns its sends and completions. A late warmup result cannot change measured totals.
export type Timed = { ms: number; ok: boolean; json?: any };
export type Kind = 'list' | 'write' | 'session' | 'today';
export class LoadCohort {
  sent = { list: 0, write: 0, session: 0, today: 0 };
  failed = { list: 0, write: 0, session: 0, today: 0 };
  lat = { list: [] as number[], write: [] as number[], session: [] as number[], today: [] as number[] };
  pending = new Set<Promise<void>>();
  fire(kind: Kind, request: Promise<Timed>, observe: (result: Timed) => void = () => {}) {
    this.sent[kind]++;
    const done = request.then(result => {
      if (result.ok) { this.lat[kind].push(result.ms); observe(result); }
      else this.failed[kind]++;
    }, () => { this.failed[kind]++; }).finally(() => { this.pending.delete(done); });
    this.pending.add(done);
  }
  async drain() { await Promise.all([...this.pending]); }
  counts() {
    return Object.fromEntries((Object.keys(this.sent) as Kind[]).map(kind => [kind, {
      sent: this.sent[kind], success: this.lat[kind].length, failure: this.failed[kind],
    }]));
  }
}
