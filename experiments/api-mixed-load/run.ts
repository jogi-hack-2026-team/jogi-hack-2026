// Supporting Artifact / Not a Source of Truth (Issue #161).
// 現行 apps/api（Fastify + 同期predict）を別OS processとして起動し、予測（/today）と記録・一覧・session確認を
// 同時に流したときの遅延を測る。採択・公開性能・無料枠の証拠ではない。
//
// 実行（repository root、Node 24.21.0、`npm ci` と `npm run build:prediction` 済み）:
//   node experiments/api-mixed-load/run.ts
// 外部DBを使わず、apps/api のテストhelperと同じembedded PostgreSQL（apps/api/.local、Git除外）へ専用databaseを作って削除する。
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { cpus, platform, release, totalmem } from 'node:os';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { predict, predictWithQuestionPrior, type PredictionInput } from '@futureroi/prediction';
import { createTestDatabase } from '../../apps/api/tests/helpers/database.ts';
import { migrate } from '../../apps/api/src/db/migrate.ts';
import { seedDemo } from '../../apps/api/src/db/seed-demo.ts';
import { localDateIn } from '../../apps/api/src/goals/local-date.ts';
import { QUESTION_MAPPING } from '../../apps/api/src/questions/snapshot.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const apiDir = join(repoRoot, 'apps', 'api');
const TIMEZONE = 'Asia/Tokyo';
const SESSION_AMOUNT = 30;
const LOG_DAYS = 60;
// requiredFutureDone（既定はT-14の3入力）。利用者1人に1Goal。MIXED_LOAD_SIZES=a,b,c で差し替えられる（最悪入力の確認用）。
const T14_SIZES = (process.env.MIXED_LOAD_SIZES ?? '120,400,1095').split(',').map(Number);
if (T14_SIZES.length !== 3 || T14_SIZES.some((n) => !Number.isInteger(n) || n < 1 || n > 100_000)) throw new Error('MIXED_LOAD_SIZES must be three positive integers');
const USERS = 3; // 3人デモ相当
const DEMO_LOOP = { warmupMs: 5_000, measureMs: 30_000, thinkMs: [1_000, 500, 1_000] as const };
const OPEN_LOOP = { warmupMs: 1_000, measureMs: 8_000, crudPerSec: 20, todayPerSec: [1, 4, 10] as const }; // 候補spike（10-07報告）と同じ
const SESSION_IPS_PER_USER = 8; // open loopのsession確認は固定版Better Authの100回/60秒/IPに当たるため、利用者ごとに複数IPへ分散する

const sha256 = (buf: Buffer | string) => createHash('sha256').update(buf).digest('hex');
const git = (...args: string[]) => spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).stdout.trim();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const a = s.address();
      const p = typeof a === 'object' && a ? a.port : 0;
      s.close(() => resolve(p));
    });
  });
}
const pct = (a: number[], p: number) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return Math.round(s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]! * 10) / 10;
};
const summary = (a: number[]) => ({ n: a.length, p50: pct(a, 50), p95: pct(a, 95), p99: pct(a, 99), max: pct(a, 100) });

// ---- provenance --------------------------------------------------------------------------------
const engineIndex = join(repoRoot, 'packages', 'prediction', 'dist', 'src', 'index.js');
const provenance = {
  repositoryHead: git('rev-parse', 'HEAD'),
  workingTreeDirty: git('status', '--porcelain', '--', 'apps', 'packages').split('\n').filter(Boolean),
  engineSourceTree: git('rev-parse', 'HEAD:packages/prediction'),
  apiSourceTree: git('rev-parse', 'HEAD:apps/api'),
  engineDistIndexSha256: sha256(readFileSync(engineIndex)),
  node: process.version,
  platform: `${platform()}-${process.arch}`,
  osRelease: release(),
  cpu: cpus()[0]?.model,
  logicalCpus: cpus().length,
  totalMemGb: Math.round((totalmem() / 1073741824) * 10) / 10,
  startedAt: new Date().toISOString(),
};

// ---- T-14 standalone（参考。既存scriptを無改変で実行） --------------------------------------------
const bench = spawnSync(process.execPath, [join(repoRoot, 'packages', 'prediction', 'scripts', 'benchmark.mjs')], { encoding: 'utf8', maxBuffer: 64 << 20 });
if (bench.status !== 0 || !bench.stdout.trim()) throw new Error(`engine benchmark failed: ${bench.status} ${bench.stderr}`);
const benchJson = JSON.parse(bench.stdout) as { cases: { requiredFutureDone: number; firstMs: number; maxMs: number; pass: boolean }[] };

// ---- database ----------------------------------------------------------------------------------
const db = await createTestDatabase();
await migrate(db.pool, 'all');
const admin = db.pool;
const dbVersion = (await admin.query('select version()')).rows[0]!.version as string;
const encoding = (await admin.query('select pg_encoding_to_char(encoding) as e from pg_database where datname = current_database()')).rows[0]!.e as string;

// ---- server process ------------------------------------------------------------------------------
type Server = { url: string; metricsUrl: string; child: ChildProcess; stop: () => Promise<number | null>; stderr: () => string };
const secret = randomBytes(32).toString('base64url');
async function startServer(): Promise<Server> {
  const port = await freePort();
  const metricsPort = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['--import', join(here, 'server-metrics-preload.mjs'), join(apiDir, 'src', 'server.ts')], {
    cwd: apiDir,
    env: {
      PATH: process.env.PATH ?? '',
      DATABASE_URL: db.connectionString,
      HOST: '127.0.0.1',
      PORT: String(port),
      LOG_LEVEL: 'warn', // 製品既定はinfo。計測ではpipe出力を抑える（応答ごとのaccess logを書かない）
      BETTER_AUTH_SECRET: secret,
      TRUST_PROXY_HOPS: '1', // generatorがX-Forwarded-Forで利用者ごとのIPを名乗る（回数制限の鍵を分ける）
      AUTH_SIGN_IN_MAX: '1000',
      AUTH_SIGN_UP_MAX: '1000',
      MIXED_LOAD_METRICS_PORT: String(metricsPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let err = '';
  child.stderr!.on('data', (d) => (err += d));
  child.stdout!.on('data', () => {});
  const exited = new Promise<number | null>((r) => child.once('exit', (code) => r(code)));
  const deadline = Date.now() + 20_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`server exited early: ${err.slice(-800)}`);
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.status === 200) break;
    } catch {}
    if (Date.now() > deadline) throw new Error(`server did not become healthy: ${err.slice(-800)}`);
    await sleep(100);
  }
  return {
    url,
    metricsUrl: `http://127.0.0.1:${metricsPort}`,
    child,
    stderr: () => err,
    stop: async () => {
      child.kill('SIGTERM');
      return exited;
    },
  };
}

// ---- synthetic users and goals -----------------------------------------------------------------
type User = { index: number; ip: string; sessionIps: string[]; cookie: string; userId: string; writeGoalId: string; predictedGoalId: string; requiredFutureDone: number; demoGoalIds: string[]; today: string };
type Expected = { oldBody: string; r11Body: string };
const users: User[] = [];
const expectedToday = new Map<string, Expected>(); // goalId -> 決定的な期待応答（Engineはseed固定）

function cookieHeader(res: Response): string {
  return res.headers.getSetCookie().map((line) => line.split(';')[0]!.trim()).filter((pair) => !pair.endsWith('=')).join('; ');
}

async function call(server: Server, method: string, path: string, u: { cookie: string; ip: string }, body?: unknown) {
  const res = await fetch(server.url + path, {
    method,
    headers: { cookie: u.cookie, 'x-forwarded-for': u.ip, origin: server.url, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, text, json: text ? JSON.parse(text) : null };
}

const goalInput = (title: string) => ({ title, unit: 'minutes', totalRequired: 6000, sessionAmount: SESSION_AMOUNT, initialProgress: 0, timezone: TIMEZONE });

async function seed(server: Server) {
  for (let i = 0; i < USERS; i++) {
    const ip = `198.51.100.${i + 1}`;
    const email = `load-${i + 1}-${randomBytes(3).toString('hex')}@example.test`;
    const res = await fetch(`${server.url}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: server.url, 'x-forwarded-for': ip },
      body: JSON.stringify({ name: `load ${i + 1}`, email, password: randomBytes(18).toString('base64url') }),
    });
    if (res.status !== 200) throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
    const cookie = cookieHeader(res);
    const userId = (await admin.query<{ id: string }>('select id from "user" where email = $1', [email])).rows[0]!.id;
    const u = { cookie, ip };
    const write = await call(server, 'POST', '/api/goals', u, goalInput(`write ${i + 1}`));
    const predicted = await call(server, 'POST', '/api/goals', u, goalInput(`predicted ${T14_SIZES[i]}`));
    if (write.status !== 201 || predicted.status !== 201) throw new Error('goal creation failed');
    const today = write.json.today as string;
    // 60日分の合成記録（昨日・今日は未記録）。total_requiredを「今日DONEにしたあと残りN回」になるよう調整する。
    await admin.query(
      `insert into action_log (goal_id, local_date, status, amount)
         select $1, ($4::date - d)::date, case when (d * 7 + $2) % 3 = 0 then 'SKIPPED' else 'DONE' end,
                case when (d * 7 + $2) % 3 = 0 then null else $3::int end
           from generate_series(2, ${LOG_DAYS + 1}) as d`,
      [predicted.json.id, i, SESSION_AMOUNT, today],
    );
    await admin.query(
      `update goal set total_required = (select sum(amount) from action_log where goal_id = $1) + $2::int * $3::int,
                       record_start_date = (select min(local_date) from action_log where goal_id = $1) where id = $1`,
      [predicted.json.id, SESSION_AMOUNT, T14_SIZES[i]! + 1],
    );
    const demo = await seedDemo(admin, { userId, timezone: TIMEZONE });
    users.push({
      index: i, ip, cookie, userId, today,
      sessionIps: Array.from({ length: SESSION_IPS_PER_USER }, (_, k) => `203.0.113.${i * 16 + k + 1}`),
      writeGoalId: write.json.id, predictedGoalId: predicted.json.id, requiredFutureDone: T14_SIZES[i]!,
      demoGoalIds: demo.goals.map((g) => g.id),
    });
  }
}

// 独立oracle: DBの事実から純粋Engineを直接呼び、/todayの応答と比較する。
async function oracleFor(goalId: string, today: string): Promise<{ old: unknown; r11: unknown; expectedFutureDone: number }> {
  const row = (await admin.query('select total_required, initial_progress, session_amount from goal where id = $1', [goalId])).rows[0]!;
  const logs = (await admin.query(`select local_date::text as "localDate", status, amount from action_log where goal_id = $1 order by local_date`, [goalId])).rows as PredictionInput['logs'];
  const input: PredictionInput = { goal: { totalRequired: row.total_required, initialProgress: row.initial_progress, sessionAmount: row.session_amount }, logs: [...logs], today };
  const done = row.initial_progress + logs.reduce((s, l) => s + (l.status === 'DONE' ? l.amount! : 0), 0);
  const remaining = row.total_required - done - (logs.some((l) => l.localDate === today) ? 0 : row.session_amount);
  const expectedFutureDone = remaining <= 0 ? 0 : Math.ceil(remaining / row.session_amount);
  return { old: predict(input), r11: predictWithQuestionPrior({ prediction: input, answers: { a: null, b: null }, mapping: QUESTION_MAPPING }).prediction, expectedFutureDone };
}

async function wiring(server: Server) {
  const checks: unknown[] = [];
  let ok = true;
  for (const u of users) {
    for (const goalId of [u.predictedGoalId, ...u.demoGoalIds]) {
      const oracle = await oracleFor(goalId, u.today);
      const old = await call(server, 'GET', `/api/goals/${goalId}/today`, u);
      const r11 = await call(server, 'GET', `/api/goals/${goalId}/today?view=r11`, u);
      const oldMatch = old.status === 200 && JSON.stringify(old.json.prediction) === JSON.stringify(oracle.old);
      const r11Match = r11.status === 200 && JSON.stringify(r11.json.prediction) === JSON.stringify(oracle.r11);
      const sizeMatch = goalId !== u.predictedGoalId || oracle.expectedFutureDone === u.requiredFutureDone;
      ok &&= oldMatch && r11Match && sizeMatch && old.json.todayLog === null;
      expectedToday.set(goalId, { oldBody: old.text, r11Body: r11.text });
      checks.push({ user: u.index + 1, goalId, kind: goalId === u.predictedGoalId ? `predicted ${u.requiredFutureDone}` : 'demo', oldStatus: old.status, r11Status: r11.status,
        oldMatchesOracle: oldMatch, r11MatchesOracle: r11Match, expectedFutureDone: oracle.expectedFutureDone, todayLog: old.json.todayLog, completion: old.json.prediction?.completion });
    }
  }
  return { ok, checks };
}

// ---- load generator ------------------------------------------------------------------------------
type Kind = 'list' | 'write' | 'session' | 'today' | 'demoToday';
type Timed = { ms: number; ok: boolean; status: number; mismatch: boolean };
class Cohort {
  sent: Record<Kind, number> = { list: 0, write: 0, session: 0, today: 0, demoToday: 0 };
  failed: Record<Kind, number> = { list: 0, write: 0, session: 0, today: 0, demoToday: 0 };
  mismatched: Record<Kind, number> = { list: 0, write: 0, session: 0, today: 0, demoToday: 0 };
  lat: Record<Kind, number[]> = { list: [], write: [], session: [], today: [], demoToday: [] };
  statuses = new Map<string, number>();
  pending = new Set<Promise<void>>();
  fire(kind: Kind, p: Promise<Timed>) {
    this.sent[kind]++;
    const done = p.then((r) => {
      this.statuses.set(`${kind}:${r.status}`, (this.statuses.get(`${kind}:${r.status}`) ?? 0) + 1);
      if (r.ok) this.lat[kind].push(r.ms); else this.failed[kind]++;
      if (r.mismatch) this.mismatched[kind]++;
    }, () => { this.failed[kind]++; }).finally(() => { this.pending.delete(done); });
    this.pending.add(done);
    return done;
  }
  drain() { return Promise.all([...this.pending]); }
  counts() {
    return Object.fromEntries((Object.keys(this.sent) as Kind[]).map((k) => [k, { sent: this.sent[k], success: this.lat[k].length, failure: this.failed[k], mismatch: this.mismatched[k] }]));
  }
}

async function timed(server: Server, method: string, path: string, u: { cookie: string; ip: string }, body?: unknown, expect?: string): Promise<Timed> {
  const t0 = performance.now();
  try {
    const res = await fetch(server.url + path, {
      method,
      headers: { cookie: u.cookie, 'x-forwarded-for': u.ip, origin: server.url, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    return { ms: performance.now() - t0, ok: res.status < 400, status: res.status, mismatch: expect !== undefined && res.status === 200 && text !== expect };
  } catch {
    return { ms: performance.now() - t0, ok: false, status: 0, mismatch: false };
  }
}

const metrics = {
  reset: async (s: Server) => { if (!(await fetch(`${s.metricsUrl}/reset`, { method: 'POST' })).ok) throw new Error('metrics reset failed'); },
  snapshot: async (s: Server) => (await fetch(`${s.metricsUrl}/snapshot`)).json(),
};

const todayPath = (goalId: string, view: 'old' | 'r11') => `/api/goals/${goalId}/today${view === 'r11' ? '?view=r11' : ''}`;
const expectFor = (goalId: string, view: 'old' | 'r11') => (view === 'r11' ? expectedToday.get(goalId)!.r11Body : expectedToday.get(goalId)!.oldBody);

// シナリオ1: 3人デモ相当（closed loop）。各利用者が「Today→記録→一覧→session→デモGoalのToday」を考える時間つきで繰り返す。
async function demoLoopScenario() {
  const server = await startServer();
  const run = async (cohort: Cohort, durationMs: number) => {
    const end = performance.now() + durationMs;
    await Promise.all(users.map(async (u) => {
      let n = 0;
      while (performance.now() < end) {
        await cohort.fire('today', timed(server, 'GET', todayPath(u.predictedGoalId, 'r11'), u, undefined, expectFor(u.predictedGoalId, 'r11')));
        await sleep(DEMO_LOOP.thinkMs[0]);
        await cohort.fire('write', timed(server, 'PUT', `/api/goals/${u.writeGoalId}/logs/${u.today}`, u, { status: n % 2 ? 'SKIPPED' : 'DONE', ...(n % 2 ? {} : { amount: SESSION_AMOUNT }) }));
        await sleep(DEMO_LOOP.thinkMs[1]);
        await cohort.fire('list', timed(server, 'GET', '/api/goals', u));
        await cohort.fire('session', timed(server, 'GET', '/api/auth/get-session', u));
        const demoGoal = u.demoGoalIds[n % 2]!;
        await cohort.fire('demoToday', timed(server, 'GET', todayPath(demoGoal, 'r11'), u, undefined, expectFor(demoGoal, 'r11')));
        await sleep(DEMO_LOOP.thinkMs[2]);
        n++;
      }
    }));
    await cohort.drain();
  };
  const warmup = new Cohort();
  await run(warmup, DEMO_LOOP.warmupMs);
  await metrics.reset(server);
  const measured = new Cohort();
  const t0 = performance.now();
  await run(measured, DEMO_LOOP.measureMs);
  const elapsedMs = Math.round(performance.now() - t0);
  const server_ = await metrics.snapshot(server);
  const exit = await server.stop();
  return {
    scenario: { name: 'demo-3-users-closed-loop', users: USERS, todayView: 'r11', thinkMs: DEMO_LOOP.thinkMs, warmupMs: DEMO_LOOP.warmupMs, measureMs: DEMO_LOOP.measureMs },
    elapsedMs, serverExitCode: exit,
    latency: { today: summary(measured.lat.today), demoToday: summary(measured.lat.demoToday), write: summary(measured.lat.write), list: summary(measured.lat.list), session: summary(measured.lat.session) },
    rates: Object.fromEntries((Object.keys(measured.sent) as Kind[]).map((k) => [k, Math.round((measured.sent[k] / elapsedMs) * 1000 * 100) / 100])),
    cohort: measured.counts(), warmup: warmup.counts(), statuses: Object.fromEntries(measured.statuses),
    server: server_,
    raw: measured.lat,
  };
}

// シナリオ2: 候補spikeと同じopen loop。CRUD 20rps（list/write/sessionを順番に）、todayを1/4/10rpsで固定送信。
async function openLoopScenario(view: 'old' | 'r11', todayPerSec: number) {
  const server = await startServer();
  const phase = async (cohort: Cohort, durationMs: number) => {
    let crud = 0;
    const crudTimer = setInterval(() => {
      const n = crud++;
      const u = users[n % users.length]!;
      if (n % 3 === 0) cohort.fire('list', timed(server, 'GET', '/api/goals', u));
      else if (n % 3 === 1) cohort.fire('write', timed(server, 'PUT', `/api/goals/${u.writeGoalId}/logs/${u.today}`, u, { status: 'DONE', amount: SESSION_AMOUNT }));
      else cohort.fire('session', timed(server, 'GET', '/api/auth/get-session', { cookie: u.cookie, ip: u.sessionIps[Math.floor(n / 3) % u.sessionIps.length]! }));
    }, 1000 / OPEN_LOOP.crudPerSec);
    let sent = 0;
    let pending = 0;
    const todayTimer = todayPerSec > 0 ? setInterval(() => {
      const u = users[sent++ % users.length]!;
      pending++;
      cohort.fire('today', timed(server, 'GET', todayPath(u.predictedGoalId, view), u, undefined, expectFor(u.predictedGoalId, view)).then((r) => (pending--, r)));
    }, 1000 / todayPerSec) : null;
    await sleep(durationMs);
    clearInterval(crudTimer);
    if (todayTimer) clearInterval(todayTimer);
    const unfinished = pending;
    await cohort.drain();
    return unfinished;
  };
  const warmup = new Cohort();
  await phase(warmup, OPEN_LOOP.warmupMs);
  await metrics.reset(server);
  const measured = new Cohort();
  const unfinished = await phase(measured, OPEN_LOOP.measureMs);
  const server_ = await metrics.snapshot(server);
  const exit = await server.stop();
  return {
    scenario: { name: 'open-loop-like-spike', todayView: view, todayPerSec, crudPerSec: OPEN_LOOP.crudPerSec, warmupMs: OPEN_LOOP.warmupMs, measureMs: OPEN_LOOP.measureMs },
    serverExitCode: exit,
    latency: { crud: summary([...measured.lat.list, ...measured.lat.write]), list: summary(measured.lat.list), write: summary(measured.lat.write), session: summary(measured.lat.session), today: { ...summary(measured.lat.today), unfinishedWhenWindowClosed: unfinished } },
    cohort: measured.counts(), warmup: warmup.counts(), statuses: Object.fromEntries(measured.statuses),
    server: server_,
    raw: measured.lat,
  };
}

// ---- main ----------------------------------------------------------------------------------------
const seedServer = await startServer();
await seed(seedServer);
const wired = await wiring(seedServer);
await seedServer.stop();
console.log(`wiring: ${wired.ok ? 'PASS' : 'FAIL'} (${wired.checks.length} goals checked)`);
if (!wired.ok) console.log(JSON.stringify(wired.checks, null, 2));

const demo = await demoLoopScenario();
console.log(`demo-3-users | today p95 ${demo.latency.today.p95}ms max ${demo.latency.today.max}ms | demoToday p95 ${demo.latency.demoToday.p95}ms | write p95 ${demo.latency.write.p95}ms | list p95 ${demo.latency.list.p95}ms | session p95 ${demo.latency.session.p95}ms | loop max ${demo.server.eventLoopDelay.maxMs}ms | cpu ${demo.server.cpuUtilization}`);

const open: Awaited<ReturnType<typeof openLoopScenario>>[] = [];
open.push(await openLoopScenario('old', 0));
for (const view of ['old', 'r11'] as const) for (const rate of OPEN_LOOP.todayPerSec) open.push(await openLoopScenario(view, rate));
for (const r of open) {
  console.log(`open ${r.scenario.todayView.padEnd(3)} today ${String(r.scenario.todayPerSec).padStart(2)}/s | crud p95 ${String(r.latency.crud.p95).padStart(7)}ms | session p95 ${String(r.latency.session.p95).padStart(7)}ms | today p95 ${String(r.latency.today.p95).padStart(7)}ms max ${String(r.latency.today.max).padStart(7)}ms (unfinished ${r.latency.today.unfinishedWhenWindowClosed}) | loop max ${String(r.server.eventLoopDelay.maxMs).padStart(7)}ms | cpu ${r.server.cpuUtilization} | fail ${Object.values(r.cohort).reduce((a, c) => a + c.failure, 0)} mismatch ${Object.values(r.cohort).reduce((a, c) => a + c.mismatch, 0)}`);
}

await db.close();

const settled = [demo, ...open].every((r) => Object.values({ ...r.cohort, ...r.warmup }).every((c) => c.sent === c.success + c.failure));
const result = {
  label: 'Supporting Artifact / Not a Source of Truth (Issue #161)',
  provenance: { ...provenance, finishedAt: new Date().toISOString(), database: dbVersion, databaseEncoding: encoding, todayInGoalTimezone: users[0]!.today },
  conditions: {
    users: USERS, timezone: TIMEZONE, sessionAmount: SESSION_AMOUNT, logDaysPerPredictedGoal: LOG_DAYS, predictedGoals: users.map((u) => ({ user: u.index + 1, requiredFutureDone: u.requiredFutureDone })),
    demoSeedGoalsPerUser: 2, serverEnv: { LOG_LEVEL: 'warn', TRUST_PROXY_HOPS: 1, AUTH_SIGN_IN_MAX: 1000, AUTH_SIGN_UP_MAX: 1000, NODE_ENV: 'unset (development defaults, loopback HTTP)' },
    sessionIpsPerUserInOpenLoop: SESSION_IPS_PER_USER,
    phaseBoundary: 'warmup stop/drain -> server metrics reset -> measurement stop/drain -> server metrics snapshot -> SIGTERM',
    computeTimeProxy: 'The current API has no in-service compute timer. Server event-loop delay max approximates the longest synchronous block (predict) per run.',
  },
  checks: {
    wiring: wired,
    allCohortsSettled: settled,
    noRequestFailed: [demo, ...open].every((r) => Object.values(r.cohort).every((c) => c.failure === 0)),
    noOracleMismatch: [demo, ...open].every((r) => Object.values(r.cohort).every((c) => c.mismatch === 0)),
  },
  t14Standalone: benchJson.cases.map((c) => ({ requiredFutureDone: c.requiredFutureDone, firstMs: Math.round(c.firstMs * 100) / 100, maxMs: Math.round(c.maxMs * 100) / 100, pass: c.pass })),
  demoLoop: demo,
  openLoop: open,
  caveats: [
    'Load generator, API server and embedded PostgreSQL run on the same machine with many cores. Not 1 vCPU, not a cloud runtime.',
    'Each condition ran once. Treat values as order-of-magnitude.',
    'Three representative predicted inputs (T-14 sizes with 60 days of logs) plus the two Demo Seed goals per user. Not a worst case over all inputs.',
    'LOG_LEVEL=warn suppresses the per-request access log that the production default (info) would write.',
    'Open-loop session checks rotate over several X-Forwarded-For IPs per user to stay under the fixed Better Auth 100/60s per-IP limit; this does not change API behaviour, only the rate-limit key.',
  ],
};
const tag = provenance.startedAt.replace(/[-:.]/g, '').slice(0, 15);
const outDir = join(here, 'results', tag);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'mixed-load.json'), JSON.stringify(result, null, 2) + '\n');
console.log(`\nchecks: wiring ${wired.ok} settled ${settled} noFail ${result.checks.noRequestFailed} noMismatch ${result.checks.noOracleMismatch} -> ${outDir}`);
process.exit(wired.ok && settled && result.checks.noRequestFailed && result.checks.noOracleMismatch ? 0 : 1);
