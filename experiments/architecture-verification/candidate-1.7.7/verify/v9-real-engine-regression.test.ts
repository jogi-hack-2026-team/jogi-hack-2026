// Supporting Artifact / Not a Source of Truth. Synthetic jobs and in-memory HTTP boundary checks.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import type { Auth } from '../src/auth.ts';
import { buildApp } from '../src/app.ts';
import { PredictPool } from '../src/predict-pool.ts';
import { runReal, validateRealInput, realQuantity, engineUrl } from '../src/predict-real.ts';
import { LoadCohort } from './load-cohort.ts';

const input = { goal: { totalRequired: 100, initialProgress: 0, sessionAmount: 10 }, logs: [], today: '2026-10-07' };
const fixture = new URL('./fixtures/worker-lifecycle.ts', import.meta.url);
async function settles<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('unsettled jobs')), 4000); })]); }
  finally { clearTimeout(timer!); }
}
test('explicit reference engine path is used; no checkout-local dist fallback', () => {
  if (process.env.SPIKE_ENGINE_ROOT) assert.equal(engineUrl.pathname.replace(/\\/g, '/').toLowerCase(),
    new URL('file:///' + process.env.SPIKE_ENGINE_ROOT.replace(/\\/g, '/') + '/dist/src/index.js').pathname.toLowerCase());
});
test('future DONE uses actual progress and today state once (unrecorded, DONE, SKIPPED, completed)', () => {
  for (const n of [120, 400, 1095]) {
    const x = { ...input, goal: { totalRequired: 1200 + (n + 1) * 30, initialProgress: 1200, sessionAmount: 30 } };
    assert.equal(runReal(x).requiredFutureDone, n);
    assert.equal(runReal({ ...x, logs: [{ localDate: x.today, status: 'DONE', amount: 30 }] }).requiredFutureDone, n);
    assert.equal(runReal({ ...x, logs: [{ localDate: x.today, status: 'SKIPPED', amount: null }] }).requiredFutureDone, n + 1);
  }
  assert.equal(runReal({ ...input, goal: { ...input.goal, initialProgress: 100 } }).requiredFutureDone, 0);
});
test('fraction 10.5 and unsafe integers are rejected for every quantity; accumulated overflow is rejected', () => {
  for (const text of ['10.5', '9007199254740991.1', '9007199254740992', '1e3']) assert.throws(() => realQuantity(text, 1));
  assert.equal(realQuantity('9007199254740991.000', 1), Number.MAX_SAFE_INTEGER);
  for (const field of ['totalRequired', 'sessionAmount', 'initialProgress']) for (const value of [10.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validateRealInput({ ...input, goal: { ...input.goal, [field]: value } }), { name: 'RealInputValidationError' });
  }
  assert.throws(() => validateRealInput({ ...input, goal: { ...input.goal, initialProgress: Number.MAX_SAFE_INTEGER },
    logs: [{ localDate: input.today, status: 'DONE', amount: 1 }] }), { name: 'RealInputValidationError' });
});
test('real worker rejects Engine date exception and fractional input, then computes a normal job', async () => {
  const pool = new PredictPool(1);
  try {
    await assert.rejects(settles(pool.runReal({ ...input, today: '2026-02-30' })), { name: 'PredictionInputError' });
    await assert.rejects(settles(pool.runReal({ ...input, goal: { ...input.goal, totalRequired: 10.5 } })), { name: 'RealInputValidationError' });
    assert.equal((await settles(pool.runReal(input))).real.requiredFutureDone, 9);
  } finally { await pool.close(); }
});
for (const [name, ms] of [['worker exit', -1], ['worker error', -2], ['malformed envelope', -3]] as const) {
  test(`${name} fails closed: running + queued + later jobs all reject`, async () => {
    const pool = new PredictPool(2, fixture);
    try {
      const results = await settles(Promise.allSettled([pool.run(ms), pool.run(10000), pool.run(0), pool.run(0)]));
      assert.ok(results.every(r => r.status === 'rejected'));
      await assert.rejects(pool.run(0), { name: 'PredictPoolUnavailableError' });
    } finally { await pool.close(); }
  });
}
test('postMessage clone failure and close settle running/queued promises; close is idempotent', async () => {
  const pool = new PredictPool(1);
  try {
    await assert.rejects(settles(pool.runReal({ ...input, extra: () => {} } as typeof input)), { name: 'PredictPoolUnavailableError' });
  } finally { await pool.close(); }
  const closing = new PredictPool(1, fixture);
  const jobs = Promise.allSettled([closing.run(10000), closing.run(0), closing.run(0)]);
  await closing.close(); await closing.close();
  assert.ok((await settles(jobs)).every(r => r.status === 'rejected'));
  await assert.rejects(closing.run(0));
});
test('late warmup completions cannot enter measured cohort; success and failures reconcile per kind', async () => {
  const warm = new LoadCohort(), measured = new LoadCohort();
  let complete!: (r: { ms: number; ok: boolean }) => void;
  warm.fire('today', new Promise(r => { complete = r; }));
  measured.fire('today', Promise.resolve({ ms: 1, ok: true }));
  measured.fire('write', Promise.reject(new Error('synthetic transport failure')));
  complete({ ms: 999, ok: true });
  await warm.drain(); await measured.drain();
  assert.deepEqual(measured.lat.today, [1]); assert.deepEqual(warm.lat.today, [999]);
  for (const c of [warm, measured]) for (const n of Object.values(c.counts())) assert.equal(n.sent, n.success + n.failure);
});

test('HTTP real-mode invalid inputs return 422; worker death returns 503 while health stays available', async () => {
  let row: any = { timezone: 'UTC', total_required: '100', initial_progress: '0', session_amount: '10', logs: [] };
  const query = async () => ({ rowCount: 1, rows: [row] });
  const pool = { connect: async () => ({ query, release() {} }), waitingCount: 0 } as unknown as Pool;
  const auth = { api: { getSession: async () => ({ user: { id: 'synthetic' } }) } } as unknown as Auth;
  const app = await buildApp({ pool, auth, baseURL: 'http://localhost', bridge: 'hardened', ajvMode: 'strict',
    trustProxyHops: 0, metrics: false, logger: false,
    predict: { mode: 'worker', workers: 1, burnMs: 0, engine: 'real', workerUrl: fixture } });
  const goalId = '00000000-0000-4000-8000-000000000001';
  try {
    for (const value of [10.5, Number.MAX_SAFE_INTEGER + 1]) {
      const r = await app.inject({ method: 'POST', url: '/api/goals', headers: { origin: 'http://localhost' }, payload: {
        title: 'synthetic', unit: 'minutes', totalRequired: value, initialProgress: 0, sessionAmount: 10, timezone: 'UTC' } });
      assert.equal(r.statusCode, 422);
      const log = await app.inject({ method: 'PUT', url: `/api/goals/${goalId}/logs/2026-10-07`, headers: { origin: 'http://localhost' }, payload: { status: 'DONE', amount: value } });
      assert.equal(log.statusCode, 422);
    }
    row = { ...row, initial_progress: String(Number.MAX_SAFE_INTEGER), logs: [{ localDate: '2026-10-01', status: 'DONE', amount: 1 }] };
    assert.equal((await app.inject(`/api/goals/${goalId}/today`)).statusCode, 422);
    row = { ...row, initial_progress: '0', logs: [{ localDate: '2026-10-01', status: 'DONE', amount: '9007199254740991.1' }] };
    assert.equal((await app.inject(`/api/goals/${goalId}/today`)).statusCode, 422);
    row = { ...row, initial_progress: '0', logs: [] };
  } finally { await app.close(); }
  const dead = await buildApp({ pool, auth, baseURL: 'http://localhost', bridge: 'hardened', ajvMode: 'strict',
    trustProxyHops: 0, metrics: false, logger: false,
    predict: { mode: 'worker', workers: 1, burnMs: 0, engine: 'real', workerUrl: new URL('./fixtures/worker-death.ts', import.meta.url) } });
  try {
    assert.equal((await settles(dead.inject(`/api/goals/${goalId}/today`))).statusCode, 503);
    assert.equal((await dead.inject(`/api/goals/${goalId}/today`)).statusCode, 503);
    assert.equal((await dead.inject('/api/health')).statusCode, 200);
  } finally { await dead.close(); }
});
