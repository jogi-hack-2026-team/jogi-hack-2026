// Supporting Artifact / Not a Source of Truth (Issue #84).
// Verification 1 (cont.): Better Auth rate limiting stored in PostgreSQL, across restarts,
// across instances, under parallel requests, and with forged forwarding headers.
import pg from 'pg';
import { createAuth } from '../src/auth.ts';
import { migrate } from '../src/migrate.ts';
import { startPg } from '../src/pg-embedded.ts';
import { newCredentials, newSecret, Report } from './lib.ts';
import { startServer } from './proc.ts';

const report = new Report('verification-1 rate limiting');
const secret = newSecret();
const MAX = 5;

const db = await startPg({ name: 'v1rl', port: 55486, fresh: true });
const admin = new pg.Pool({ connectionString: db.connectionString, max: 2 });
await migrate(admin, createAuth({ pool: admin, secret, baseURL: 'http://127.0.0.1:3190' }));

const base = (port: number, over: Record<string, string> = {}) => ({
  NODE_ENV: 'production',
  DATABASE_URL: db.connectionString,
  BETTER_AUTH_SECRET: secret,
  PORT: String(port),
  BASE_URL: `http://127.0.0.1:${port}`,
  SPIKE_BRIDGE: 'hardened',
  SPIKE_TRUST_PROXY_HOPS: '1',
  SPIKE_RATE_LIMIT_STORAGE: 'database',
  SPIKE_SIGNIN_MAX: String(MAX),
  SPIKE_SIGNUP_MAX: '50',
  ...over,
});

const cred = newCredentials();
async function attempt(url: string, xff: string | null, password = 'wrong-password-for-the-spike') {
  const res = await fetch(url + '/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: url, ...(xff ? { 'x-forwarded-for': xff } : {}) },
    body: JSON.stringify({ email: cred.email, password }),
  });
  await res.arrayBuffer();
  return { status: res.status, retryAfter: res.headers.get('x-retry-after') };
}
const many = async (url: string, xff: string | null, n: number) => {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push((await attempt(url, xff)).status);
  return out;
};
const keys = async () => (await admin.query('select key, count from "rateLimit" order by key')).rows;

// ---- database storage ---------------------------------------------------------------------
let s1 = await startServer(base(3190));
await fetch(s1.url + '/api/auth/sign-up/email', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: s1.url, 'x-forwarded-for': '198.51.100.1' },
  body: JSON.stringify(cred),
});

const r1 = await many(s1.url, '198.51.100.7', MAX + 2);
const last = await attempt(s1.url, '198.51.100.7');
report.add('R1', `the first ${MAX} sign-in attempts from one IP are processed, later ones get 429 with X-Retry-After`, JSON.stringify(r1) === JSON.stringify([401, 401, 401, 401, 401, 429, 429]) && last.status === 429 && Number(last.retryAfter) > 0, { statuses: r1, retryAfterPresent: last.retryAfter !== null });
report.info('R1b', 'rows written to the "rateLimit" table', await keys());

const correct = await attempt(s1.url, '198.51.100.7', cred.password);
report.add('R2', 'while limited, even the correct password is refused (429) for that IP', correct.status === 429, correct);

const other = await attempt(s1.url, '198.51.100.8');
report.add('R3', 'a different client IP is not affected (per-IP bucket)', other.status === 401, other);

const spoof: number[] = [];
for (let i = 0; i < 4; i++) spoof.push((await attempt(s1.url, `203.0.113.${10 + i}, 198.51.100.7`)).status);
report.add('R4', 'rotating a forged left-most X-Forwarded-For value does not escape the limit (hardened bridge + 1 trusted hop)', spoof.every((s) => s === 429), { statuses: spoof });

await s1.stop();
s1 = await startServer(base(3190));
const afterRestart = await attempt(s1.url, '198.51.100.7');
report.add('R5', 'after a process restart the limit still applies (stored in PostgreSQL)', afterRestart.status === 429, afterRestart);

const s2 = await startServer(base(3191));
const split = [...(await many(s1.url, '198.51.100.9', 3)), ...(await many(s2.url, '198.51.100.9', 3))];
report.add('R6', 'two instances share one counter: 3 attempts on A + 3 on B -> the 6th is 429', JSON.stringify(split) === JSON.stringify([401, 401, 401, 401, 401, 429]), { statuses: split });

const burst = await Promise.all(Array.from({ length: 20 }, (_, i) => attempt(i % 2 ? s1.url : s2.url, '198.51.100.10')));
const processed = burst.filter((b) => b.status !== 429).length;
report.add('R7', `20 parallel attempts across two instances: at most ${MAX} are processed (atomic counting)`, processed <= MAX && processed > 0, { processed, limited: 20 - processed });
await s2.stop();
await s1.stop();

// ---- memory storage (for contrast) ---------------------------------------------------------
let m1 = await startServer(base(3192, { SPIKE_RATE_LIMIT_STORAGE: 'memory' }));
const mem1 = await many(m1.url, '198.51.100.20', MAX + 1);
await m1.stop();
m1 = await startServer(base(3192, { SPIKE_RATE_LIMIT_STORAGE: 'memory' }));
const mem2 = await many(m1.url, '198.51.100.20', 1);
const m2 = await startServer(base(3193, { SPIKE_RATE_LIMIT_STORAGE: 'memory' }));
const memSplit = [...(await many(m1.url, '198.51.100.21', MAX)), ...(await many(m2.url, '198.51.100.21', MAX))];
report.add('R8', 'memory storage: the counter is lost on restart and is not shared between instances', mem1[MAX] === 429 && mem2[0] === 401 && memSplit.every((s) => s === 401), {
  beforeRestart: mem1,
  firstAttemptAfterRestart: mem2,
  fiveOnAThenFiveOnB: memSplit,
  note: 'Same limit, same IP. 10 attempts were processed where the DB-backed limiter allows 5.',
});
await m2.stop();
await m1.stop();

// ---- the bridge exactly as in the official guide ------------------------------------------
const d1 = await startServer(base(3194, { SPIKE_BRIDGE: 'docs', SPIKE_TRUST_PROXY_HOPS: '0' }));
const single = await many(d1.url, '198.51.100.30', MAX + 1);
const victim = await attempt(d1.url, '198.51.100.31');
report.add('R9', 'guide bridge, single-value X-Forwarded-For: per-IP limiting works', single[MAX] === 429 && victim.status === 401, { attacker: single, otherClient: victim.status });
// Two-value header (what any client can send through a proxy that appends): no trusted IP can be resolved.
const multiA = await many(d1.url, '203.0.113.50, 198.51.100.40', MAX + 1);
const multiB = await attempt(d1.url, '203.0.113.51, 198.51.100.41');
const noHeader = await attempt(d1.url, null);
report.info('R10', 'guide bridge, multi-value or missing X-Forwarded-For: every such client shares ONE bucket', {
  clientA: multiA,
  differentClientB: multiB.status,
  clientWithoutHeader: noHeader.status,
  rows: (await keys()).filter((k: any) => !/^\d+\.\d+\.\d+\.\d+\|/.test(k.key)),
  note: 'Client B and the header-less client are refused because client A used up the shared bucket. With the guide bridge, one client can lock sign-in for everyone behind a proxy that appends to X-Forwarded-For. The hardened bridge passes exactly one IP taken from Fastify trustProxy.',
});
await d1.stop();

await admin.end();
await db.stop();
const s = report.save('v1-rate-limit.json', { config: { signInMax: MAX, windowSec: 60, nodeEnv: 'production' } });
process.exit(s.fail ? 1 : 0);
