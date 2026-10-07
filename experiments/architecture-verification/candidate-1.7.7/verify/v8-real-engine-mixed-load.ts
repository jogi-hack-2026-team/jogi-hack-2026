// Supporting Artifact / Not a Source of Truth (Issue #84).
// Verification 2 with the real Prediction Engine (packages/prediction, merged to main after the
// placeholder runs in v2). Two questions:
//   1. T-14 on the candidate runtime: does each real predict call stay under 500 ms here?
//   2. Service: what happens to CRUD / session latency while /today runs the real engine,
//      inline on the event loop versus in the same-process worker pool?
// This is one laptop running the generator, the API and PostgreSQL. It is not evidence for
// Cloud Run 1 vCPU, and it adopts neither a worker pool nor an HTTP contract for the engine.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import pg from 'pg';
import { createAuth } from '../src/auth.ts';
import { migrate } from '../src/migrate.ts';
import { rootDir, startPg } from '../src/pg-embedded.ts';
import { client, goalInput, newCredentials, newSecret, Report } from './lib.ts';
import { startServer } from './proc.ts';

const report = new Report('verification-2 mixed load with the real prediction engine');
const secret = newSecret();
const USERS = 2; // Same limit as the other candidate runs: only two synthetic identities.
const REQUIRED_FUTURE_DONE = [120, 400, 1095]; // the three T-14 sizes, one predicted goal each
const LOG_DAYS = 60;
const SESSION_AMOUNT = 30;
const DURATION_MS = 8000;
const WARMUP_MS = 1000;
const CRUD_PER_SEC = 20; // open loop: list / write / get-session in rotation
const POOL_MAX = 5;
const WORKERS = 2;
const TODAY_RATES = [1, 4, 10];

const repoRoot = join(rootDir, '..', '..', '..');
const engineDir = join(repoRoot, 'packages', 'prediction');
if (!existsSync(join(engineDir, 'dist', 'src', 'index.js'))) {
  throw new Error('Build the engine first: node packages/prediction/scripts/check.mjs test (from the repository root).');
}
const git = (...args: string[]) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
const engineProvenance = {
  repositoryHead: git('rev-parse', 'HEAD'),
  engineLastCommit: git('log', '-1', '--format=%H', '--', 'packages/prediction'),
  engineWorkingTreeClean: git('status', '--porcelain', '--', 'packages/prediction') === '',
};

// ---- T-14 on this runtime: the engine's own benchmark, unmodified ------------------------------
const bench = spawnSync(process.execPath, [join(engineDir, 'scripts', 'benchmark.mjs')], { cwd: engineDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const benchJson = JSON.parse(bench.stdout) as {
  environment: unknown;
  config: unknown;
  cases: { requiredFutureDone: number; requiredByT14: boolean; firstMs: number; warmMs: number[]; maxMs: number; pass: boolean }[];
};
const t14 = benchJson.cases.map((c) => ({ requiredFutureDone: c.requiredFutureDone, requiredByT14: c.requiredByT14, firstMs: c.firstMs, warmMs: c.warmMs, maxMs: c.maxMs, pass: c.pass }));

const db = await startPg({ name: 'v8', port: 55592, fresh: true });
const admin = new pg.Pool({ connectionString: db.connectionString, max: 2 });
await migrate(admin, createAuth({ pool: admin, secret, baseURL: 'http://127.0.0.1:3230' }));
const dbVersion = (await admin.query('select version()')).rows[0].version as string;

const env = (over: Record<string, string>) => ({
  NODE_ENV: 'production',
  DATABASE_URL: db.connectionString,
  BETTER_AUTH_SECRET: secret,
  PORT: '3230',
  BASE_URL: 'http://127.0.0.1:3230',
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

// ---- seed ---------------------------------------------------------------------------------------
// Each predicted goal has 60 days of logs, no log for yesterday or today, and a total that leaves
// exactly one of the T-14 sizes still to do. Writes go to a separate goal per user so that the
// predicted goals stay "today unrecorded" for the whole run.
type User = { cookie: string; ip: string; writeGoalId: string; today: string };
const users: User[] = [];
const predicted: { user: User; goalId: string; requiredFutureDone: number }[] = [];
const setup = await startServer(env({ SPIKE_PREDICT_ENGINE: 'real' }));
for (let i = 0; i < USERS; i++) {
  const c = client(setup.url, setup.url);
  const ip = `198.51.100.${i + 1}`;
  await c.call('POST', '/api/auth/sign-up/email', newCredentials(), { 'x-forwarded-for': ip });
  const w = await c.call('POST', '/api/goals', goalInput(`write ${i}`));
  const t = await c.call('GET', `/api/goals/${w.json.id}/today`);
  users.push({ cookie: c.jar.header(), ip, writeGoalId: w.json.id, today: t.json.today });
}
for (let k = 0; k < REQUIRED_FUTURE_DONE.length; k++) {
  const user = users[k % USERS];
  const g = await (await fetch(setup.url + '/api/goals', {
    method: 'POST',
    headers: { cookie: user.cookie, origin: setup.url, 'x-forwarded-for': user.ip, 'content-type': 'application/json' },
    body: JSON.stringify(goalInput(`predicted ${REQUIRED_FUTURE_DONE[k]}`)),
  })).json();
  await admin.query(
    `insert into action_log (goal_id, local_date, status, amount)
     select $1, (current_date - d)::date, case when (d * 7 + $2) % 3 = 0 then 'SKIPPED' else 'DONE' end,
            case when (d * 7 + $2) % 3 = 0 then null else $4::numeric end
       from generate_series(2, $3) as d`,
    [g.id, k, LOG_DAYS + 1, SESSION_AMOUNT],
  );
  await admin.query(
    `update goal set total_required = (select sum(amount) from action_log where goal_id = $1) + $2::numeric * $3::numeric where id = $1`,
    [g.id, SESSION_AMOUNT, REQUIRED_FUTURE_DONE[k]],
  );
  predicted.push({ user, goalId: g.id, requiredFutureDone: REQUIRED_FUTURE_DONE[k] });
}
// One real /today per predicted goal before any load: confirms the wiring and the seeded sizes.
const wiring = [];
for (const p of predicted) {
  const res = await fetch(`${setup.url}/api/goals/${p.goalId}/today`, { headers: { cookie: p.user.cookie, 'x-forwarded-for': p.user.ip } });
  const body = await res.json();
  wiring.push({ expected: p.requiredFutureDone, status: res.status, todayLog: body.todayLog, yesterdayMissing: body.yesterdayMissing, prediction: body.prediction });
}
await setup.stop();

// ---- load generator -----------------------------------------------------------------------------
const pct = (a: number[], p: number) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return Math.round(s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] * 10) / 10;
};
const summary = (a: number[]) => ({ n: a.length, p50: pct(a, 50), p95: pct(a, 95), p99: pct(a, 99), max: pct(a, 100) });

type Timed = { ms: number; ok: boolean; json?: any };
async function timed(url: string, method: string, path: string, u: { cookie: string; ip: string }, body?: unknown, parse = false): Promise<Timed> {
  const t0 = performance.now();
  try {
    const res = await fetch(url + path, {
      method,
      headers: { cookie: u.cookie, 'x-forwarded-for': u.ip, origin: url, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    const json = parse ? await res.json() : (await res.arrayBuffer(), undefined);
    return { ms: performance.now() - t0, ok: res.status < 400, json };
  } catch {
    return { ms: performance.now() - t0, ok: false };
  }
}

type Scenario = { engine: 'placeholder' | 'real'; mode: 'inline' | 'worker'; todayPerSec: number };

async function run(sc: Scenario) {
  const srv = await startServer(env({ SPIKE_PREDICT_ENGINE: sc.engine, SPIKE_PREDICT_MS: '0', SPIKE_PREDICT_MODE: sc.mode }));
  const lat = { list: [] as number[], write: [] as number[], session: [] as number[], today: [] as number[] };
  let errors = 0;
  let measuring = false;
  let realResponses = 0;
  let nonRealResponses = 0;
  const sizesSeen = new Map<number, number>();
  const clientSeenComputeMs: number[] = [];
  const rec = (k: keyof typeof lat, r: Timed) => {
    if (!measuring) return;
    if (!r.ok) return void errors++;
    lat[k].push(r.ms);
    if (k !== 'today') return;
    const p = r.json?.prediction;
    if (p?.placeholder === false) {
      realResponses++;
      sizesSeen.set(p.requiredFutureDone, (sizesSeen.get(p.requiredFutureDone) ?? 0) + 1);
      clientSeenComputeMs.push(p.computeMs);
    } else nonRealResponses++;
  };

  // Open loop for everything: requests arrive on a fixed schedule whether or not earlier ones
  // finished. (A closed loop would hide the time clients spend waiting behind a blocked server.)
  const pending = new Set<Promise<void>>();
  const fire = (k: keyof typeof lat, p: Promise<Timed>) => {
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
    else if (n % 3 === 1) fire('write', timed(srv.url, 'PUT', `/api/goals/${u.writeGoalId}/logs/${u.today}`, u, { status: 'DONE', amount: SESSION_AMOUNT }));
    else fire('session', timed(srv.url, 'GET', '/api/auth/get-session', u));
  }, 1000 / CRUD_PER_SEC);
  let sent = 0;
  let todayPending = 0;
  const interval = setInterval(() => {
    const p = predicted[sent++ % predicted.length];
    todayPending++;
    fire('today', timed(srv.url, 'GET', `/api/goals/${p.goalId}/today`, p.user, undefined, true).then((r) => (todayPending--, r)));
  }, 1000 / sc.todayPerSec);

  await new Promise((r) => setTimeout(r, WARMUP_MS));
  await fetch(srv.url + '/api/spike/metrics/reset', { method: 'POST', headers: { origin: srv.url } });
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

  return {
    scenario: sc,
    crud: summary([...lat.list, ...lat.write]),
    session: summary(lat.session),
    today: { sent: todaySent, unfinishedWhenWindowClosed: unfinishedAtEnd, ...summary(lat.today) },
    errors,
    engine: {
      realResponses,
      nonRealResponses,
      requiredFutureDoneSeen: Object.fromEntries([...sizesSeen].sort((a, b) => a[0] - b[0])),
      serverComputeMs: metrics.predictCompute.count ? { count: metrics.predictCompute.count, p50: metrics.predictCompute.p50Ms, p95: metrics.predictCompute.p95Ms, max: metrics.predictCompute.maxMs } : null,
      responseComputeMsMax: clientSeenComputeMs.length ? Math.max(...clientSeenComputeMs) : null,
    },
    server: {
      cpuUtilization: Math.round(((metrics.cpuUserMs + metrics.cpuSystemMs) / metrics.wallMs) * 100) / 100,
      rssMb: metrics.rssMb,
      eventLoopDelayMeanMs: metrics.eventLoopDelay.meanMs,
      eventLoopDelayP99Ms: metrics.eventLoopDelay.p99Ms,
      eventLoopDelayMaxMs: metrics.eventLoopDelay.maxMs,
      dbAcquireWaitP95Ms: metrics.dbAcquireWait.p95Ms,
      dbAcquireWaitMaxMs: metrics.dbAcquireWait.maxMs,
      poolMaxWaiting: metrics.poolMaxWaiting,
      workerQueueWaitP95Ms: metrics.workerQueueWait.count ? metrics.workerQueueWait.p95Ms : null,
      workerQueueWaitMaxMs: metrics.workerQueueWait.count ? metrics.workerQueueWait.maxMs : null,
    },
  };
}

const scenarios: Scenario[] = [{ engine: 'placeholder', mode: 'inline', todayPerSec: 4 }];
for (const rate of TODAY_RATES) for (const mode of ['inline', 'worker'] as const) scenarios.push({ engine: 'real', mode, todayPerSec: rate });

const runs = [];
for (const sc of scenarios) {
  const r = await run(sc);
  runs.push(r);
  console.log(
    `${sc.engine.padEnd(11)} ${sc.mode.padEnd(6)} ${String(sc.todayPerSec).padStart(2)}/s | crud p95 ${String(r.crud.p95).padStart(6)}ms | session p95 ${String(r.session.p95).padStart(6)}ms | today p95 ${String(r.today.p95).padStart(6)}ms (unfinished ${r.today.unfinishedWhenWindowClosed}) | compute max ${String(r.engine.serverComputeMs?.max ?? '-').padStart(6)}ms | loop max ${String(r.server.eventLoopDelayMaxMs).padStart(6)}ms | cpu ${r.server.cpuUtilization} | errors ${r.errors}`,
  );
}

const real = runs.filter((r) => r.scenario.engine === 'real');
report.add('E0', 'T-14 on this runtime: every required real predict call is under 500 ms (engine benchmark, unmodified)', bench.status === 0 && t14.filter((c) => c.requiredByT14).length === 3 && t14.every((c) => !c.requiredByT14 || c.pass), { exitCode: bench.status, environment: benchJson.environment, config: benchJson.config, cases: t14 });
report.add('E1', 'wiring: /today returns a real-engine result for each seeded T-14 size, today unrecorded', wiring.every((w) => w.status === 200 && w.prediction?.placeholder === false && w.prediction.requiredFutureDone === w.expected && w.todayLog === null), wiring);
report.add('E2', 'no request failed in any real-engine scenario', real.every((r) => r.errors === 0), real.map((r) => ({ scenario: r.scenario, errors: r.errors })));
report.add('E3', 'every measured /today in the real-engine scenarios was computed by the real engine, covering all three sizes', real.every((r) => r.engine.nonRealResponses === 0 && r.engine.realResponses === r.today.n && REQUIRED_FUTURE_DONE.every((n) => (r.engine.requiredFutureDoneSeen[n] ?? 0) > 0)), real.map((r) => ({ scenario: r.scenario, ...r.engine })));
report.add('E4', 'in-service compute: every real predict call measured inside the server is under 500 ms', real.every((r) => r.engine.serverComputeMs !== null && r.engine.serverComputeMs.max < 500), real.map((r) => ({ scenario: r.scenario, serverComputeMs: r.engine.serverComputeMs })));
report.info('E5', 'mixed-load runs (baseline without compute, then real engine inline vs worker pool)', runs);

await admin.end();
await db.stop();
const s = report.save('v8-real-engine-mixed-load.json', {
  engineProvenance,
  setup: {
    users: USERS, predictedGoals: REQUIRED_FUTURE_DONE.map((n) => ({ requiredFutureDone: n })), logDaysPerGoal: LOG_DAYS, sessionAmount: SESSION_AMOUNT,
    crudOpenLoopPerSec: CRUD_PER_SEC, crudMix: 'GET /api/goals, PUT log (separate write goal), GET /api/auth/get-session in rotation',
    todayPerSec: TODAY_RATES, measuredWindowMs: DURATION_MS, warmupMs: WARMUP_MS, pgPoolMax: POOL_MAX, workerThreads: WORKERS, database: dbVersion,
    caveats: [
      'Load generator, API server and PostgreSQL all run on the same laptop with many cores. Not Cloud Run 1 vCPU.',
      'Each scenario was run once for 8 s. Treat the numbers as order-of-magnitude.',
      'Open-loop generator in a separate process on the same machine; latency is measured from the moment each request is sent.',
      'Three representative inputs (the T-14 sizes with 60 days of logs). Not a worst case over all inputs.',
      'The /today response carries a load-observation summary of the engine result, not the Product DTO.',
    ],
  },
});
process.exit(s.fail ? 1 : 0);
