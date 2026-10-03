// Supporting Artifact / Not a Source of Truth (Issue #84).
// Verification 1: Fastify + Better Auth + PostgreSQL, minimal connection checks.
import pg from 'pg';
import { createAuth } from '../src/auth.ts';
import { migrate } from '../src/migrate.ts';
import { startPg } from '../src/pg-embedded.ts';
import { client, cookieShape, goalInput, newCredentials, newSecret, Report, startStack } from './lib.ts';

const report = new Report('verification-1 auth and database');
const secret = newSecret();

// ---- A. empty database -> migrate -> start -------------------------------------------------
const db = await startPg({ name: 'v1', port: 55485, fresh: true });
const adminPool = new pg.Pool({ connectionString: db.connectionString, max: 2 });
const version = (await adminPool.query('select version()')).rows[0].version as string;
report.info('A0', 'PostgreSQL server under test', { version, source: 'embedded-postgres binaries (no Docker on this machine)' });

const before = (await adminPool.query(`select count(*)::int as n from information_schema.tables where table_schema = 'public'`)).rows[0].n;
report.add('A1', 'database starts empty', before === 0, { publicTables: before });

const migAuth = createAuth({ pool: adminPool, secret, baseURL: 'http://127.0.0.1:3184' });
const first = await migrate(adminPool, migAuth);
const tables = (await adminPool.query(`select table_name from information_schema.tables where table_schema = 'public' order by 1`)).rows.map((r) => r.table_name);
report.add(
  'A2',
  'first migrate creates auth tables (incl. rateLimit), then app tables',
  ['user', 'session', 'account', 'verification', 'rateLimit', 'goal', 'action_log'].every((t) => tables.includes(t)),
  { first, tables },
);
const second = await migrate(adminPool, migAuth);
report.add(
  'A3',
  'second migrate is a no-op (idempotent)',
  second.authTablesCreated.length === 0 && second.authColumnsAdded.length === 0 && second.appMigrationsApplied.length === 0,
  second,
);

// ---- B. auth flow through the Fastify bridge ---------------------------------------------
const stack = await startStack({ connectionString: db.connectionString, port: 3184, secret, auth: { signUpMax: 50, signInMax: 50 } });
const origin = stack.url;
const A = client(stack.url, origin);
const B = client(stack.url, origin);
const credA = newCredentials();
const credB = newCredentials();

const health = await A.call('GET', '/api/health');
report.add('B0', 'health responds and includes a DB round trip', health.status === 200 && health.json.ok === true, health.json);

const protectedRoutes: [string, string, unknown?][] = [
  ['GET', '/api/goals'],
  ['POST', '/api/goals', goalInput()],
  ['GET', '/api/goals/00000000-0000-4000-8000-000000000000'],
  ['DELETE', '/api/goals/00000000-0000-4000-8000-000000000000'],
  ['PUT', '/api/goals/00000000-0000-4000-8000-000000000000/logs/2026-09-30', { status: 'SKIPPED' }],
  ['GET', '/api/goals/00000000-0000-4000-8000-000000000000/today'],
];
const anon = client(stack.url, origin);
const anonStatuses = [];
for (const [m, p, b] of protectedRoutes) anonStatuses.push({ route: `${m} ${p.replace(/0{8}-.*?(?=\/|$)/, ':goalId')}`, status: (await anon.call(m, p, b)).status });
report.add('B1', 'every protected route returns 401 without a session', anonStatuses.every((s) => s.status === 401), anonStatuses);

const signUp = await A.call('POST', '/api/auth/sign-up/email', credA);
report.add('B2', 'sign-up succeeds and sets a session cookie', signUp.status === 200 && A.jar.cookies.size > 0, {
  status: signUp.status,
  setCookie: signUp.setCookie.map(cookieShape),
});
const sessionCookie = signUp.setCookie.map(cookieShape).find((c) => c.name.endsWith('session_token'));
const attrs = (sessionCookie?.attributes ?? []).map((a) => a.toLowerCase());
report.add(
  'B3',
  'session cookie is HttpOnly, SameSite=Lax, Path=/ (no Secure on plain http base URL)',
  attrs.includes('httponly') && attrs.includes('samesite=lax') && attrs.includes('path=/') && !attrs.includes('secure'),
  sessionCookie,
);

const me = await A.call('GET', '/api/auth/get-session');
report.add('B4', 'get-session returns the signed-up user', me.status === 200 && me.json?.user?.email === credA.email, { status: me.status, hasUser: !!me.json?.user });

const reload = await fetch(stack.url + '/api/goals', { headers: { cookie: A.jar.header() } }); // cookie only, like a page reload
report.add('B5', 'a fresh request carrying only the cookie is still authenticated ("reload")', reload.status === 200, { status: reload.status });

const oldCookie = A.jar.header();
const signOut = await A.call('POST', '/api/auth/sign-out', {});
report.add('B6', 'sign-out succeeds and clears cookies with several Set-Cookie lines', signOut.status === 200 && signOut.setCookie.length >= 2, {
  status: signOut.status,
  setCookieLines: signOut.setCookie.length,
  setCookie: signOut.setCookie.map(cookieShape),
});
const replay = await fetch(stack.url + '/api/goals', { headers: { cookie: oldCookie } });
report.add('B7', 'the old cookie is rejected after sign-out (session revoked in the DB)', replay.status === 401, { status: replay.status });

const wrong = await A.call('POST', '/api/auth/sign-in/email', { email: credA.email, password: credA.password + 'x' });
report.add('B8', 'sign-in with a wrong password fails with 401', wrong.status === 401, { status: wrong.status, code: wrong.json?.code });

const signIn = await A.call('POST', '/api/auth/sign-in/email', { email: credA.email, password: credA.password });
report.add('B9', 'sign-in succeeds again after sign-out', signIn.status === 200 && A.jar.cookies.size > 0, { status: signIn.status });

const evil = client(stack.url, 'http://evil.example');
const evilRes = await evil.call('POST', '/api/auth/sign-in/email', { email: credA.email, password: credA.password });
report.add('B10', 'sign-in from an untrusted Origin is rejected', evilRes.status === 403, { status: evilRes.status, code: evilRes.json?.code });

// A cross-origin request that already carries a valid cookie (CSRF shape).
const csrf = await fetch(stack.url + '/api/auth/sign-out', {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie: A.jar.header(), origin: 'http://evil.example' },
  body: '{}',
});
report.add('B11', 'a cookie-bearing POST from an untrusted Origin is rejected (auth endpoints)', csrf.status === 403, { status: csrf.status });
const csrfApp = await fetch(stack.url + '/api/goals', {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie: A.jar.header(), origin: 'http://evil.example' },
  body: JSON.stringify(goalInput('csrf probe')),
});
report.add('B12', 'app mutation rejects foreign Origin without weakening auth protection', csrfApp.status === 403, {
  status: csrfApp.status,
  note: 'Provisional same-origin-only mutation policy. Node explicitly supplies cookie; browser behavior is tested separately.',
});

// ---- C. ownership: someone else's goal is 404 -------------------------------------------
await B.call('POST', '/api/auth/sign-up/email', credB);
const goalA = await A.call('POST', '/api/goals', goalInput('A goal'));
report.add('C0', 'owner can create a goal', goalA.status === 201 && typeof goalA.json?.id === 'string', { status: goalA.status });
const gid = goalA.json.id as string;
const asB = [
  { op: 'GET goal', status: (await B.call('GET', `/api/goals/${gid}`)).status },
  { op: 'GET today', status: (await B.call('GET', `/api/goals/${gid}/today`)).status },
  { op: 'PUT log', status: (await B.call('PUT', `/api/goals/${gid}/logs/2026-09-30`, { status: 'DONE', amount: 30 })).status },
  { op: 'DELETE goal', status: (await B.call('DELETE', `/api/goals/${gid}`)).status },
];
const logsAfter = (await adminPool.query('select count(*)::int as n from action_log where goal_id = $1', [gid])).rows[0].n;
const stillThere = (await A.call('GET', `/api/goals/${gid}`)).status;
report.add('C1', "another user's goal is 404 for read, today, log write and delete; nothing is written or removed", asB.every((s) => s.status === 404) && logsAfter === 0 && stillThere === 200, { asB, logsWrittenByOther: logsAfter, ownerStillSees: stillThere });
const listB = await B.call('GET', '/api/goals');
report.add('C2', "list returns only the caller's goals", listB.status === 200 && listB.json.length === 0, { count: listB.json?.length });

// ---- D. contract: validation -> 422, response shape, status-specific body ----------------
const bad = await A.call('POST', '/api/goals', { ...goalInput(), totalRequired: 0, extra: 'x' });
const badPaths = (bad.json?.error?.fields ?? []).map((f: any) => f.path);
report.add('D1', 'contract violation returns 422 naming every offending field (needs allErrors)', bad.status === 422 && badPaths.includes('body/totalRequired') && badPaths.includes('body/extra'), bad.json);
const keys = Object.keys(goalA.json).sort();
report.add('D2', 'response carries only contract fields (row columns user_id / created_at are not leaked)', JSON.stringify(keys) === JSON.stringify(['id', 'initialProgress', 'sessionAmount', 'timezone', 'title', 'totalRequired', 'unit']), { keys });
const done = await A.call('PUT', `/api/goals/${gid}/logs/2026-09-30`, { status: 'DONE', amount: 30 });
const again = await A.call('PUT', `/api/goals/${gid}/logs/2026-09-30`, { status: 'SKIPPED' });
const rows = (await adminPool.query('select status, amount from action_log where goal_id = $1', [gid])).rows;
report.add('D3', 'log upsert: same day overwrites, one row per (goal, date)', done.status === 200 && again.status === 200 && rows.length === 1 && rows[0].status === 'SKIPPED' && rows[0].amount === null, { rows });
const strictCases = {
  skippedWithAmount: (await A.call('PUT', `/api/goals/${gid}/logs/2026-09-29`, { status: 'SKIPPED', amount: 30 })).status,
  doneWithoutAmount: (await A.call('PUT', `/api/goals/${gid}/logs/2026-09-29`, { status: 'DONE' })).status,
  amountAsString: (await A.call('PUT', `/api/goals/${gid}/logs/2026-09-29`, { status: 'DONE', amount: '30' })).status,
  badDate: (await A.call('PUT', `/api/goals/${gid}/logs/2026-02-31`, { status: 'SKIPPED' })).status,
};
report.add('D4', 'strict Ajv options: SKIPPED+amount, DONE without amount, string amount, impossible date are all 422', Object.values(strictCases).every((s) => s === 422), strictCases);
const today = await A.call('GET', `/api/goals/${gid}/today`);
report.add('D5', 'today endpoint returns server-decided dates from one snapshot (prediction is a labelled placeholder)', today.status === 200 && /^\d{4}-\d{2}-\d{2}$/.test(today.json.today) && today.json.prediction.placeholder === true, today.json);
const nope = await A.call('GET', '/api/nope');
report.add('D6', 'unknown API route is a JSON 404', nope.status === 404 && nope.json?.error?.code === 'NOT_FOUND', { status: nope.status });

// Same cases against Fastify's DEFAULT Ajv options (removeAdditional + coerceTypes).
const loose = await startStack({ connectionString: db.connectionString, port: 3185, secret, ajvMode: 'default', auth: { signUpMax: 50, signInMax: 50 } });
const L = client(loose.url, loose.url);
await L.call('POST', '/api/auth/sign-in/email', { email: credA.email, password: credA.password });
const defaultCases = {
  skippedWithAmount: (await L.call('PUT', `/api/goals/${gid}/logs/2026-09-28`, { status: 'SKIPPED', amount: 30 })).status,
  doneWithoutAmount: (await L.call('PUT', `/api/goals/${gid}/logs/2026-09-28`, { status: 'DONE' })).status,
  amountAsString: (await L.call('PUT', `/api/goals/${gid}/logs/2026-09-27`, { status: 'DONE', amount: '30' })).status,
  extraFieldOnGoal: (await L.call('POST', '/api/goals', { ...goalInput('extra'), extra: 'x' })).status,
};
report.info('D7', "Fastify's default Ajv options silently accept what the contract should reject", {
  defaultCases,
  note: 'removeAdditional drops the unexpected property and coerceTypes converts "30" to 30, so these requests pass instead of returning 422. The strict options in D4 are required for the status-specific contract.',
});
await loose.stop();

// ---- E. the Fastify <-> Better Auth bridge --------------------------------------------------
// Ground truth: how many Set-Cookie lines Better Auth itself emits on sign-out.
const direct = client(stack.url, origin);
await direct.call('POST', '/api/auth/sign-in/email', { email: credA.email, password: credA.password });
const truth = await stack.auth.handler(
  new Request(stack.url + '/api/auth/sign-out', { method: 'POST', headers: { cookie: direct.jar.header(), origin, 'content-type': 'application/json' }, body: '{}' }),
);
const truthLines = truth.headers.getSetCookie().length;

const docs = await startStack({ connectionString: db.connectionString, port: 3186, secret, bridge: 'docs', auth: { signUpMax: 50, signInMax: 50 } });
const D = client(docs.url, docs.url);
const dIn = await D.call('POST', '/api/auth/sign-in/email', { email: credA.email, password: credA.password });
const dMe = await D.call('GET', '/api/goals');
const dOut = await D.call('POST', '/api/auth/sign-out', {});
const H = client(stack.url, origin);
await H.call('POST', '/api/auth/sign-in/email', { email: credA.email, password: credA.password });
const hOut = await H.call('POST', '/api/auth/sign-out', {});
report.add('E1', 'bridge from the official guide: sign-in, authenticated call and sign-out work', dIn.status === 200 && dMe.status === 200 && dOut.status === 200, { signIn: dIn.status, goals: dMe.status, signOut: dOut.status });
report.add('E2', 'both bridges forward every Set-Cookie line Better Auth emits', dOut.setCookie.length === truthLines && hOut.setCookie.length === truthLines, {
  betterAuthDirect: truthLines,
  docsBridge: dOut.setCookie.length,
  hardenedBridge: hOut.setCookie.length,
});
await docs.stop();

// HTTPS base URL (what staging/production would use): Secure cookies.
const tls = await startStack({ connectionString: db.connectionString, port: 3187, secret, baseURL: 'https://spike.example.test', auth: { signUpMax: 50, signInMax: 50 } });
const T = client(tls.url, 'https://spike.example.test');
const tIn = await T.call('POST', '/api/auth/sign-in/email', { email: credA.email, password: credA.password });
const tCookie = tIn.setCookie.map(cookieShape).find((c) => c.name.endsWith('session_token'));
const tAttrs = (tCookie?.attributes ?? []).map((a) => a.toLowerCase());
report.add('E3', 'with an https base URL the session cookie is Secure and uses the __Secure- prefix', tIn.status === 200 && tAttrs.includes('secure') && !!tCookie?.name.startsWith('__Secure-'), tCookie);
const tWrongOrigin = await client(tls.url, tls.url).call('POST', '/api/auth/sign-in/email', { email: credA.email, password: credA.password });
report.add('E4', 'with an https base URL, the plain-http origin is no longer trusted', tWrongOrigin.status === 403, { status: tWrongOrigin.status });
await tls.stop();

// ---- F. same database: FK + cascade (SQL level) -------------------------------------------
const goalB = await B.call('POST', '/api/goals', goalInput('B goal'));
await B.call('PUT', `/api/goals/${goalB.json.id}/logs/2026-09-30`, { status: 'DONE', amount: 30 });
const userB = (await adminPool.query('select id from "user" where email = $1', [credB.email])).rows[0].id;
const cl = await adminPool.connect();
await cl.query('begin');
await cl.query('delete from "user" where id = $1', [userB]);
const inTx = (await cl.query('select (select count(*) from goal where user_id = $1)::int as goals, (select count(*) from session where "userId" = $1)::int as sessions', [userB])).rows[0];
await cl.query('rollback');
cl.release();
const afterRollback = (await adminPool.query('select count(*)::int as n from goal where user_id = $1', [userB])).rows[0].n;
report.add('F1', 'deleting a user row removes that user\'s goals, logs and sessions inside one transaction (FK cascade); rollback restores them', inTx.goals === 0 && inTx.sessions === 0 && afterRollback === 1, {
  insideTransaction: inTx,
  afterRollback: { goals: afterRollback },
  note: 'SQL-level check of the schema. Better Auth\'s own delete-user endpoint/hooks were not exercised.',
});

// DB constraints from #74 (direct SQL, bypassing the API).
const constraint = async (sql: string, params: unknown[]) => {
  try {
    await adminPool.query(sql, params);
    return 'accepted';
  } catch (e: any) {
    return e.code as string;
  }
};
const dbRules = {
  duplicateDay: await constraint(`insert into action_log (goal_id, local_date, status, amount) values ($1, '2026-09-30', 'SKIPPED', null)`, [gid]),
  doneWithoutAmount: await constraint(`insert into action_log (goal_id, local_date, status, amount) values ($1, '2026-09-01', 'DONE', null)`, [gid]),
  skippedWithAmount: await constraint(`insert into action_log (goal_id, local_date, status, amount) values ($1, '2026-09-02', 'SKIPPED', 5)`, [gid]),
};
report.add('F2', 'DB rejects duplicate (goal, date), DONE without amount, SKIPPED with amount', dbRules.duplicateDay === '23505' && dbRules.doneWithoutAmount === '23514' && dbRules.skippedWithAmount === '23514', dbRules);

await stack.stop();
await adminPool.end();
await db.stop();
const s = report.save('v1-auth-db.json');
process.exit(s.fail ? 1 : 0);
