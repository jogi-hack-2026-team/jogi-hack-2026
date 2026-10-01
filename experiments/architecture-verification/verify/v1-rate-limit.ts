// Supporting Artifact / Not a Source of Truth (Issue #84).
// Verification 1 (cont.): Better Auth rate limiting stored in PostgreSQL, across restarts,
// across instances, under parallel requests, and with forged forwarding headers. Also checks that
// the advertised wait time (X-Retry-After) is one a screen could show, and that it is truthful.
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import { createAuth } from '../src/auth.ts';
import { migrate } from '../src/migrate.ts';
import { startPg } from '../src/pg-embedded.ts';
import { newCredentials, newSecret, Report } from './lib.ts';
import { startServer } from './proc.ts';

const report = new Report('verification-1 rate limiting');
const secret = newSecret();
const MAX = 5;
const WINDOW_SEC = 60; // sign-in window configured in src/auth.ts

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
  SPIKE_PG_INT8: 'number',
  SPIKE_SIGNIN_MAX: String(MAX),
  SPIKE_SIGNUP_MAX: '50',
  ...over,
});

type Attempt = { status: number; retryAfter: string | null };
// A wait time a screen can show: whole seconds, at least 1 and never longer than the window.
const validRetryAfter = (v: string | null) => v !== null && /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= WINDOW_SEC;
const statuses = (a: Attempt[]) => a.map((x) => x.status);
const sameStatuses = (a: Attempt[], expected: number[]) => JSON.stringify(statuses(a)) === JSON.stringify(expected);

const cred = newCredentials();
async function attempt(url: string, xff: string | null, password = 'wrong-password-for-the-spike'): Promise<Attempt> {
  const res = await fetch(url + '/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: url, ...(xff ? { 'x-forwarded-for': xff } : {}) },
    body: JSON.stringify({ email: cred.email, password }),
  });
  await res.arrayBuffer();
  return { status: res.status, retryAfter: res.headers.get('x-retry-after') };
}
const many = async (url: string, xff: string | null, n: number) => {
  const out: Attempt[] = [];
  for (let i = 0; i < n; i++) out.push(await attempt(url, xff));
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
const lastAt = Date.now();
report.add(
  'R1',
  `the first ${MAX} sign-in attempts from one IP are processed, later ones get 429 with an X-Retry-After of 1..${WINDOW_SEC} whole seconds`,
  sameStatuses(r1, [401, 401, 401, 401, 401, 429, 429]) && last.status === 429 && [...r1.slice(MAX), last].every((a) => validRetryAfter(a.retryAfter)),
  { statuses: statuses(r1), retryAfterOf429s: [...r1.slice(MAX), last].map((a) => a.retryAfter) },
);
report.info('R1b', 'rows written to the "rateLimit" table', await keys());

const correct = await attempt(s1.url, '198.51.100.7', cred.password);
report.add('R2', 'while limited, even the correct password is refused (429) for that IP, with a valid X-Retry-After', correct.status === 429 && validRetryAfter(correct.retryAfter), correct);

const other = await attempt(s1.url, '198.51.100.8');
report.add('R3', 'a different client IP is not affected (per-IP bucket)', other.status === 401, other);

const spoof: number[] = [];
for (let i = 0; i < 4; i++) spoof.push((await attempt(s1.url, `203.0.113.${10 + i}, 198.51.100.7`)).status);
report.add('R4', 'rotating a forged left-most X-Forwarded-For value does not escape the limit (hardened bridge + 1 trusted hop)', spoof.every((s) => s === 429), { statuses: spoof });

await s1.stop();
s1 = await startServer(base(3190));
const afterRestart = await attempt(s1.url, '198.51.100.7');
report.add(
  'R5',
  'after a process restart the limit still applies (stored in PostgreSQL) and X-Retry-After is valid and has not grown',
  afterRestart.status === 429 && validRetryAfter(afterRestart.retryAfter) && Number(afterRestart.retryAfter) <= Number(last.retryAfter),
  { ...afterRestart, retryAfterBeforeRestart: last.retryAfter },
);

const s2 = await startServer(base(3191));
const split = [...(await many(s1.url, '198.51.100.9', 3)), ...(await many(s2.url, '198.51.100.9', 3))];
report.add(
  'R6',
  'two instances share one counter: 3 attempts on A + 3 on B -> the 6th is 429, and instance B reports a valid X-Retry-After',
  sameStatuses(split, [401, 401, 401, 401, 401, 429]) && validRetryAfter(split[5].retryAfter),
  { statuses: statuses(split), retryAfterFromInstanceB: split[5].retryAfter },
);

const burst = await Promise.all(Array.from({ length: 20 }, (_, i) => attempt(i % 2 ? s1.url : s2.url, '198.51.100.10')));
const processed = burst.filter((b) => b.status !== 429).length;
const burstLimited = burst.filter((b) => b.status === 429);
report.add(
  'R7',
  `20 parallel attempts across two instances: at most ${MAX} are processed (atomic counting), every 429 carries a valid X-Retry-After`,
  processed <= MAX && processed > 0 && burstLimited.every((b) => validRetryAfter(b.retryAfter)),
  { processed, limited: 20 - processed, retryAfterValues: [...new Set(burstLimited.map((b) => b.retryAfter))] },
);

// The wait time must also be truthful: still limited just before it elapses, processed again once it has.
if (validRetryAfter(last.retryAfter)) {
  const releaseAt = lastAt + Number(last.retryAfter) * 1000;
  await sleep(Math.max(0, releaseAt - 1500 - Date.now()));
  const justBefore = await attempt(s1.url, '198.51.100.7');
  await sleep(Math.max(0, releaseAt - Date.now()));
  const afterWindow = [await attempt(s2.url, '198.51.100.7'), await attempt(s1.url, '198.51.100.7')];
  report.add(
    'R11',
    'the advertised wait is truthful: ~1.5 s before it elapses the IP is still limited, once it has elapsed both instances process attempts again',
    justBefore.status === 429 && validRetryAfter(justBefore.retryAfter) && Number(justBefore.retryAfter) <= 2 && sameStatuses(afterWindow, [401, 401]),
    { advertisedSeconds: last.retryAfter, justBefore, afterWindowOnInstanceBThenA: statuses(afterWindow) },
  );
} else {
  report.add('R11', 'the advertised wait is truthful (not run: X-Retry-After was not a usable wait time)', false, { advertised: last.retryAfter });
}
await s2.stop();
await s1.stop();

// ---- node-postgres defaults (for contrast) -------------------------------------------------
// "rateLimit"."lastRequest" is int8. node-postgres returns int8 as a string unless told otherwise.
const p1 = await startServer(base(3195, { SPIKE_PG_INT8: 'string' }));
const pgDefault = await many(p1.url, '198.51.100.50', MAX + 1);
const observedAt = Date.now();
await p1.stop();
const stored = (await admin.query('select "lastRequest" from "rateLimit" where key = $1', ['198.51.100.50|/sign-in/email'])).rows[0]?.lastRequest;
const concatenated = Math.ceil((Number(`${stored}${WINDOW_SEC * 1000}`) - observedAt) / 1000);
const observed = pgDefault[MAX].retryAfter;
report.add(
  'R12',
  'node-postgres defaults (int8 as string): the count limit still works, but X-Retry-After is not a usable wait time; it matches "lastRequest" and the window joined as text',
  sameStatuses(pgDefault, [401, 401, 401, 401, 401, 429]) && !validRetryAfter(observed) && Math.abs(Number(observed) - concatenated) <= 2,
  {
    statuses: statuses(pgDefault),
    retryAfter: observed,
    lastRequestReturnedAs: typeof stored,
    expectedFromTextConcatenation: concatenated,
    note: 'better-auth 1.7.6 computes lastRequest + window * 1000. With a string lastRequest that is a concatenation, not an addition.',
  },
);

// ---- memory storage (for contrast) ---------------------------------------------------------
let m1 = await startServer(base(3192, { SPIKE_RATE_LIMIT_STORAGE: 'memory' }));
const mem1 = await many(m1.url, '198.51.100.20', MAX + 1);
await m1.stop();
m1 = await startServer(base(3192, { SPIKE_RATE_LIMIT_STORAGE: 'memory' }));
const mem2 = await many(m1.url, '198.51.100.20', 1);
const m2 = await startServer(base(3193, { SPIKE_RATE_LIMIT_STORAGE: 'memory' }));
const memSplit = [...(await many(m1.url, '198.51.100.21', MAX)), ...(await many(m2.url, '198.51.100.21', MAX))];
report.add('R8', 'memory storage: the counter is lost on restart and is not shared between instances', mem1[MAX].status === 429 && mem2[0].status === 401 && memSplit.every((s) => s.status === 401), {
  beforeRestart: statuses(mem1),
  firstAttemptAfterRestart: statuses(mem2),
  fiveOnAThenFiveOnB: statuses(memSplit),
  note: 'Same limit, same IP. 10 attempts were processed where the DB-backed limiter allows 5.',
});
await m2.stop();
await m1.stop();

// ---- the bridge exactly as in the official guide ------------------------------------------
const d1 = await startServer(base(3194, { SPIKE_BRIDGE: 'docs', SPIKE_TRUST_PROXY_HOPS: '0' }));
const single = await many(d1.url, '198.51.100.30', MAX + 1);
const victim = await attempt(d1.url, '198.51.100.31');
report.add('R9', 'guide bridge, single-value X-Forwarded-For: per-IP limiting works', single[MAX].status === 429 && victim.status === 401, { attacker: statuses(single), otherClient: victim.status });
// Two-value header (what any client can send through a proxy that appends): no trusted IP can be resolved.
const multiA = await many(d1.url, '203.0.113.50, 198.51.100.40', MAX + 1);
const multiB = await attempt(d1.url, '203.0.113.51, 198.51.100.41');
const noHeader = await attempt(d1.url, null);
report.info('R10', 'guide bridge, multi-value or missing X-Forwarded-For: every such client shares ONE bucket', {
  clientA: statuses(multiA),
  differentClientB: multiB.status,
  clientWithoutHeader: noHeader.status,
  rows: (await keys()).filter((k: any) => !/^\d+\.\d+\.\d+\.\d+\|/.test(k.key)),
  note: 'Client B and the header-less client are refused because client A used up the shared bucket. With the guide bridge, one client can lock sign-in for everyone behind a proxy that appends to X-Forwarded-For. The hardened bridge passes exactly one IP taken from Fastify trustProxy.',
});
await d1.stop();

await admin.end();
await db.stop();
const s = report.save('v1-rate-limit.json', { config: { signInMax: MAX, windowSec: WINDOW_SEC, nodeEnv: 'production', pgInt8: 'number (R12: string)' } });
process.exit(s.fail ? 1 : 0);
