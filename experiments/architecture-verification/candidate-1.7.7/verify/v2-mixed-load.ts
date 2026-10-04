// Supporting Artifact / Not a Source of Truth (Issue #84).
// Verification 2 (service part): how does the API behave while "prediction" occupies the CPU?
//
// IMPORTANT: the prediction engine (#71/#72) does not exist yet, so T-14 (#73) was NOT run.
// The compute here is a placeholder that burns CPU for a requested time. These numbers say
// nothing about the engine. They show what a given compute budget does to the rest of the API.
import { performance } from 'node:perf_hooks';
import pg from 'pg';
import { createAuth } from '../src/auth.ts';
import { migrate } from '../src/migrate.ts';
import { startPg } from '../src/pg-embedded.ts';
import { client, goalInput, newCredentials, newSecret, Report } from './lib.ts';
import { startServer } from './proc.ts';

const report = new Report('verification-2 mixed load with a placeholder compute');
const secret = newSecret();
const USERS = 2; // Delegated verification limit: only two synthetic identities.
const LOG_DAYS = 60;
const DURATION_MS = 8000;
const WARMUP_MS = 1000;
const CRUD_PER_SEC = 20; // open loop: list / write / get-session in rotation
const POOL_MAX = 5;
const WORKERS = 2;

const db = await startPg({ name: 'v2', port: 55488, fresh: true });
const admin = new pg.Pool({ connectionString: db.connectionString, max: 2 });
await migrate(admin, createAuth({ pool: admin, secret, baseURL: 'http://127.0.0.1:3210' }));
const dbVersion = (await admin.query('select version()')).rows[0].version as string;

const env = (over: Record<string, string>) => ({
  NODE_ENV: 'production',
  DATABASE_URL: db.connectionString,
  BETTER_AUTH_SECRET: secret,
  PORT: '3210',
  BASE_URL: 'http://127.0.0.1:3210',
  SPIKE_METRICS: '1',
  SPIKE_SIGNUP_MAX: '1000',
  SPIKE_SIGNIN_MAX: '1000',
  // The library default (100 auth requests per IP per minute) would throttle the generator itself.
  SPIKE_RL_MAX: '1000000',
  SPIKE_TRUST_PROXY_HOPS: '1',
  PG_POOL_MAX: String(POOL_MAX),
  SPIKE_WORKERS: String(WORKERS),
  ...over,
});

// ---- seed: users, one goal each, 60 days of logs ---------------------------------------------
const setup = await startServer(env({}));
const users: { cookie: string; goalId: string; today: string; ip: string }[] = [];
for (let i = 0; i < USERS; i++) {
  const c = client(setup.url, setup.url);
  await c.call('POST', '/api/auth/sign-up/email', newCredentials(), { 'x-forwarded-for': `198.51.100.${i + 1}` });
  const g = await c.call('POST', '/api/goals', goalInput(`load ${i}`));
  await admin.query(
    `insert into action_log (goal_id, local_date, status, amount)
     select $1, (current_date - d)::date, case when (d * 7 + $2) % 3 = 0 then 'SKIPPED' else 'DONE' end,
            case when (d * 7 + $2) % 3 = 0 then null else 30 end
       from generate_series(2, $3) as d`,
    [g.json.id, i, LOG_DAYS + 1],
  );
  const t = await c.call('GET', `/api/goals/${g.json.id}/today`);
  users.push({ cookie: c.jar.header(), goalId: g.json.id, today: t.json.today, ip: `198.51.100.${i + 1}` });
}
await setup.stop();

// ---- load generator ---------------------------------------------------------------------------
const pct = (a: number[], p: number) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return Math.round(s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] * 10) / 10;
};
const summary = (a: number[]) => ({ n: a.length, p50: pct(a, 50), p95: pct(a, 95), p99: pct(a, 99), max: pct(a, 100) });

async function timed(url: string, method: string, path: string, u: { cookie: string; ip: string }, body?: unknown) {
  const t0 = performance.now();
  try {
    const res = await fetch(url + path, {
      method,
      headers: { cookie: u.cookie, 'x-forwarded-for': u.ip, origin: url, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    await res.arrayBuffer();
    return { ms: performance.now() - t0, ok: res.status < 400 };
  } catch {
    return { ms: performance.now() - t0, ok: false };
  }
}

type Scenario = { burnMs: number; mode: 'inline' | 'worker'; todayPerSec: number };

async function run(sc: Scenario) {
  const srv = await startServer(env({ SPIKE_PREDICT_MS: String(sc.burnMs), SPIKE_PREDICT_MODE: sc.mode }));
  const lat = { list: [] as number[], write: [] as number[], session: [] as number[], today: [] as number[] };
  let errors = 0;
  let measuring = false;
  const rec = (k: keyof typeof lat, r: { ms: number; ok: boolean }) => {
    if (!measuring) return;
    if (r.ok) lat[k].push(r.ms);
    else errors++;
  };

  // Open loop for everything: requests arrive on a fixed schedule whether or not earlier ones
  // finished. (A closed loop would hide the time clients spend waiting behind a blocked server.)
  const pending = new Set<Promise<void>>();
  const fire = (k: keyof typeof lat, p: Promise<{ ms: number; ok: boolean }>) => {
    const q = p.then((r) => {
      rec(k, r);
      pending.delete(q);
    });
    pending.add(q);
  };
  let crudSent = 0;
  const crudTimer = setInterval(() => {
    const n = crudSent++;
    const u = users[n % users.length];
    if (n % 3 === 0) fire('list', timed(srv.url, 'GET', '/api/goals', u));
    else if (n % 3 === 1) fire('write', timed(srv.url, 'PUT', `/api/goals/${u.goalId}/logs/${u.today}`, u, { status: 'DONE', amount: 30 }));
    else fire('session', timed(srv.url, 'GET', '/api/auth/get-session', u));
  }, 1000 / CRUD_PER_SEC);
  let sent = 0;
  let todayPending = 0;
  const interval = setInterval(() => {
    const u = users[sent++ % users.length];
    todayPending++;
    fire('today', timed(srv.url, 'GET', `/api/goals/${u.goalId}/today`, u).then((r) => (todayPending--, r)));
  }, 1000 / sc.todayPerSec);

  await new Promise((r) => setTimeout(r, WARMUP_MS));
  await fetch(srv.url + '/api/spike/metrics/reset', { method: 'POST' });
  measuring = true;
  const sentAtStart = sent;
  await new Promise((r) => setTimeout(r, DURATION_MS));
  const todaySent = sent - sentAtStart;
  clearInterval(interval);
  clearInterval(crudTimer);
  const unfinishedAtEnd = todayPending;
  await Promise.all([...pending]); // drain: late responses are still counted
  const metrics = await (await fetch(srv.url + '/api/spike/metrics')).json();
  measuring = false;
  await srv.stop();

  const crudAll = [...lat.list, ...lat.write];
  return {
    scenario: sc,
    offeredCpuLoad: Math.round(((sc.burnMs * sc.todayPerSec) / 1000) * 100) / 100, // CPU-seconds of placeholder compute requested per second
    crud: summary(crudAll),
    session: summary(lat.session),
    today: { sent: todaySent, unfinishedWhenWindowClosed: unfinishedAtEnd, ...summary(lat.today) },
    errors,
    server: {
      cpuMs: metrics.cpuUserMs + metrics.cpuSystemMs,
      wallMs: metrics.wallMs,
      cpuUtilization: Math.round(((metrics.cpuUserMs + metrics.cpuSystemMs) / metrics.wallMs) * 100) / 100,
      rssMb: metrics.rssMb,
      eventLoopDelayMeanMs: metrics.eventLoopDelay.meanMs,
      eventLoopDelayP99Ms: metrics.eventLoopDelay.p99Ms,
      eventLoopDelayMaxMs: metrics.eventLoopDelay.maxMs,
      dbAcquireWaitP95Ms: metrics.dbAcquireWait.p95Ms,
      dbAcquireWaitMaxMs: metrics.dbAcquireWait.maxMs,
      poolMaxWaiting: metrics.poolMaxWaiting,
      workerQueueWaitP95Ms: metrics.workerQueueWait.count ? metrics.workerQueueWait.p95Ms : null,
    },
  };
}

const scenarios: Scenario[] = [];
for (const rate of [1, 4]) {
  scenarios.push({ burnMs: 0, mode: 'inline', todayPerSec: rate });
  for (const burnMs of [100, 250, 500]) for (const mode of ['inline', 'worker'] as const) scenarios.push({ burnMs, mode, todayPerSec: rate });
}

const runs = [];
for (const sc of scenarios) {
  const r = await run(sc);
  runs.push(r);
  console.log(
    `${String(sc.burnMs).padStart(3)}ms ${sc.mode.padEnd(6)} ${sc.todayPerSec}/s | crud p95 ${String(r.crud.p95).padStart(7)}ms | session p95 ${String(r.session.p95).padStart(7)}ms | today p95 ${String(r.today.p95).padStart(8)}ms (unfinished ${r.today.unfinishedWhenWindowClosed}) | loop max ${String(r.server.eventLoopDelayMaxMs).padStart(7)}ms | db wait p95 ${r.server.dbAcquireWaitP95Ms}ms | cpu ${r.server.cpuUtilization}`,
  );
}

report.info('M0', 'T-14 (#73) single-computation benchmark', { status: 'NOT RUN', reason: 'No Product prediction engine exists in the inspected main snapshot. Experimental numerical prototypes are not Product engine performance evidence. Other branches were not exhaustively inspected.' });
report.info('M1', 'mixed-load runs with a placeholder compute', runs);

const base = runs.find((r) => r.scenario.burnMs === 0 && r.scenario.todayPerSec === 4)!;
const inline500 = runs.find((r) => r.scenario.burnMs === 500 && r.scenario.mode === 'inline' && r.scenario.todayPerSec === 1)!;
const worker500 = runs.find((r) => r.scenario.burnMs === 500 && r.scenario.mode === 'worker' && r.scenario.todayPerSec === 1)!;
report.add('M2', 'baseline (no compute): CRUD p95 stays under 50 ms and no request fails', (base.crud.p95 ?? 1e9) < 50 && base.errors === 0, { crud: base.crud, session: base.session, errors: base.errors });
report.add('M3', 'inline compute blocks everything else: at 500 ms x 1/s, CRUD p95 is of the order of the compute time', (inline500.crud.p95 ?? 0) > 200, { crud: inline500.crud, session: inline500.session, eventLoopDelayMaxMs: inline500.server.eventLoopDelayMaxMs });
report.add('M4', 'the same compute in a 2-thread worker pool keeps CRUD p95 under 50 ms', (worker500.crud.p95 ?? 1e9) < 50, { crud: worker500.crud, session: worker500.session, eventLoopDelayMaxMs: worker500.server.eventLoopDelayMaxMs, todayP95: worker500.today.p95 });

await admin.end();
await db.stop();
const s = report.save('v2-mixed-load.json', {
  setup: {
    users: USERS, logDaysPerGoal: LOG_DAYS, crudOpenLoopPerSec: CRUD_PER_SEC, crudMix: 'GET /api/goals, PUT log, GET /api/auth/get-session in rotation', measuredWindowMs: DURATION_MS, warmupMs: WARMUP_MS,
    pgPoolMax: POOL_MAX, workerThreads: WORKERS, database: dbVersion,
    caveats: [
      'Load generator, API server and PostgreSQL all run on the same laptop.',
      'Each scenario was run once for 8 s. Treat the numbers as order-of-magnitude.',
      'Open-loop generator in a separate process on the same machine; latency is measured from the moment each request is sent.',
      'The compute is a placeholder CPU burn, not the prediction engine.',
    ],
  },
});
process.exit(s.fail ? 1 : 0);
