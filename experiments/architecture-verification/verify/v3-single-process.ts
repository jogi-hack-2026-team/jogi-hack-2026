// Supporting Artifact / Not a Source of Truth (Issue #84).
// Verification 3 (local part): one Node process serves the built SPA and the API from the
// same origin. No container and no cloud resource is involved (Docker is not installed here).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { createAuth } from '../src/auth.ts';
import { migrate } from '../src/migrate.ts';
import { rootDir, startPg } from '../src/pg-embedded.ts';
import { client, goalInput, newCredentials, newSecret, Report } from './lib.ts';
import { startServer } from './proc.ts';

const report = new Report('verification-3 single process (local)');
const secret = newSecret();
const webDist = join(rootDir, 'web-dist');
const asset = readdirSync(join(webDist, 'assets')).find((f) => f.endsWith('.js'))!;

const db = await startPg({ name: 'v3', port: 55487, fresh: true });
const admin = new pg.Pool({ connectionString: db.connectionString, max: 2 });
await migrate(admin, createAuth({ pool: admin, secret, baseURL: 'http://127.0.0.1:3200' }));

const env = (port: number, over: Record<string, string> = {}) => ({
  NODE_ENV: 'production',
  DATABASE_URL: db.connectionString,
  BETTER_AUTH_SECRET: secret,
  PORT: String(port),
  BASE_URL: `http://127.0.0.1:${port}`,
  SPIKE_WEB_DIST: webDist,
  SPIKE_METRICS: '1',
  SPIKE_SIGNUP_MAX: '50',
  SPIKE_LOG: '1',
  ...over,
});

const srv = await startServer(env(3200));
const get = async (path: string, init?: RequestInit) => {
  const res = await fetch(srv.url + path, init);
  return { status: res.status, type: res.headers.get('content-type') ?? '', cache: res.headers.get('cache-control'), text: await res.text() };
};

const index = await get('/');
report.add('S1', 'GET / serves the SPA shell', index.status === 200 && index.type.includes('text/html') && index.text.includes('id="root"'), { status: index.status, type: index.type });
const deep = await get('/goals/3f0c1c5e-0000-4000-8000-000000000000');
report.add('S2', 'a deep client route falls back to index.html (history routing)', deep.status === 200 && deep.text.includes('id="root"'), { status: deep.status });
const js = await get(`/assets/${asset}`);
report.add('S3', 'hashed assets are served as JavaScript', js.status === 200 && js.type.includes('javascript'), { status: js.status, type: js.type, cacheControl: js.cache });
report.info('S3b', 'default cache header on hashed assets', { cacheControl: js.cache, note: 'No long-lived immutable caching unless configured on the static plugin.' });
const miss = await get('/api/nope');
const missPost = await get('/nope', { method: 'POST' });
report.add('S4', 'unknown API routes and non-GET misses stay JSON 404 (never the SPA shell)', miss.status === 404 && miss.type.includes('json') && missPost.status === 404 && missPost.type.includes('json'), { api: miss.status, post: missPost.status });

const U = client(srv.url, srv.url);
const cred = newCredentials();
const steps = {
  signUp: (await U.call('POST', '/api/auth/sign-up/email', cred)).status,
  createGoal: 0,
  putLog: 0,
  today: 0,
};
const goal = await U.call('POST', '/api/goals', goalInput('path check'));
steps.createGoal = goal.status;
const t = await U.call('GET', `/api/goals/${goal.json.id}/today`);
steps.today = t.status;
steps.putLog = (await U.call('PUT', `/api/goals/${goal.json.id}/logs/${t.json.today}`, { status: 'DONE', amount: 30 })).status;
const t2 = await U.call('GET', `/api/goals/${goal.json.id}/today`);
report.add('S5', 'static web -> auth -> DB write -> DB read -> today (placeholder prediction) works in one process', steps.signUp === 200 && steps.createGoal === 201 && steps.putLog === 200 && t2.json.todayLog?.status === 'DONE', { steps, todayLogAfterWrite: t2.json.todayLog?.status });

const cookieValue = [...U.jar.cookies.values()][0];
const logs = srv.output();
report.add('S6', 'structured request logs are written and do not contain the session cookie value or the password', logs.includes('"msg":"request completed"') && !logs.includes(cookieValue) && !logs.includes(cred.password), { logLines: logs.split('\n').filter(Boolean).length });

const metrics = JSON.parse((await get('/api/spike/metrics')).text);
report.info('S7', 'process footprint after the path check (local, not a container)', { startedInMs: srv.startedInMs, rssMb: metrics.rssMb, note: 'Startup excludes migrations (SPIKE_MIGRATE=0). Local process start, not a Cloud Run cold start.' });
await srv.stop();

// Graceful shutdown: a request that is still running when SIGTERM arrives must complete.
const slow = await startServer(env(3201, { SPIKE_PREDICT_MS: '800', SPIKE_LOG: '0' }));
const S = client(slow.url, slow.url);
await S.call('POST', '/api/auth/sign-in/email', { email: cred.email, password: cred.password });
const inflight = S.call('GET', `/api/goals/${goal.json.id}/today`);
await new Promise((r) => setTimeout(r, 150));
const t0 = performance.now();
const stopped = slow.stop('SIGTERM');
const [res, exit] = await Promise.all([inflight, stopped]);
report.add('S8', 'SIGTERM during an in-flight request: the request completes, then the process exits 0', res.status === 200 && exit.code === 0 && exit.lastLine.includes('shutdown-complete'), { inflightStatus: res.status, exitCode: exit.code, shutdownMs: Math.round(performance.now() - t0) });

report.info('S9', 'container image build', { status: 'NOT RUN', reason: 'Docker is not installed on the verification machine. No Dockerfile is included here; the container definition belongs to #70.' });
report.info('S10', 'staging (Cloud Run + Neon), sleep/wake behaviour', { status: 'NOT RUN', reason: 'No approved staging exists. Creating cloud resources needs prior approval.' });

await admin.end();
await db.stop();
const s = report.save('v3-single-process.json');
process.exit(s.fail ? 1 : 0);
