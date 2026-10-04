// Two synthetic accounts, fresh isolated DB. Positive/negative assertions separated.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { startPg } from '../src/pg-embedded.ts';
import { rootDir } from '../src/paths.ts';
import { createPool, createAuthPool } from '../src/pool.ts';
import { createAuth } from '../src/auth.ts';
import { migrate } from '../src/migrate.ts';
import { client, goalInput, newCredentials, newSecret, Report, startStack } from './lib.ts';
import { browserProbe } from './browser-probe.ts';

const report = new Report('post-fix positive and negative regressions');
const db = await startPg({ name: 'v5-fixed', port: 55591, fresh: true });
const appPool = createPool({ connectionString: db.connectionString, max: 2, int8: 'string' });
const authPool = createAuthPool({ connectionString: db.connectionString, max: 2 });
const secret = newSecret();
let stack: Awaited<ReturnType<typeof startStack>> | undefined;
let failed = false;
const serverTrace: { method: string; path: string; cookiePresent: boolean }[] = [];
try {
  await migrate(appPool, createAuth({ pool: authPool, secret, baseURL: 'http://127.0.0.1:3290' }));
  stack = await startStack({ connectionString: db.connectionString, port: 3290, secret, trustProxyHops: 1,
    observeRequest: r => serverTrace.push(r),
    auth: { pool: authPool, signUpMax: 5, signInMax: 5, generalMax: 1000 } });
  const A = client(stack.url, stack.url), B = client(stack.url, stack.url);
  const a = newCredentials(), b = newCredentials();
  const signups = [await A.call('POST', '/api/auth/sign-up/email', a), await B.call('POST', '/api/auth/sign-up/email', b)];
  report.add('P1', 'positive: only two synthetic identities, registration works', signups.every(r => r.status === 200) && (await appPool.query('select count(*)::int n from "user"')).rows[0].n === 2);
  const goal = await A.call('POST', '/api/goals', goalInput('fixed-origin owner'));
  report.add('P2', 'positive: owner same-origin creation and write/read/delete work', goal.status === 201 &&
    (await A.call('PUT', `/api/goals/${goal.json.id}/logs/2026-09-30`, { status: 'DONE', amount: 30 })).status === 200 &&
    (await A.call('GET', `/api/goals/${goal.json.id}`)).status === 200);
  const temp = await A.call('POST', '/api/goals', goalInput('delete positive'));
  report.add('P3', 'positive: same-origin owner DELETE succeeds', (await A.call('DELETE', `/api/goals/${temp.json.id}`)).status === 204);
  const paths: [string, string, unknown?][] = [['POST', '/api/goals', goalInput('rejected')],
    ['PUT', `/api/goals/${goal.json.id}/logs/2026-09-29`, { status: 'DONE', amount: 30 }], ['DELETE', `/api/goals/${goal.json.id}`]];
  for (const [label, origin] of [['cross-site', 'http://127.0.0.2:3292'], ['same-site port', 'http://127.0.0.1:3291'], ['null', 'null'], ['missing', undefined], ['spoofed suffix', stack.url + '.evil']] as const) {
    const statuses: number[] = [];
    for (const [method, path, body] of paths) {
      const r = await fetch(stack.url + path, { method, headers: { cookie: A.jar.header(),
        ...(origin === undefined ? {} : { origin }), ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
      statuses.push(r.status); await r.arrayBuffer();
    }
    report.add('O-' + label, 'negative: ' + label + ' Origin cannot create/write/delete', statuses.every(s => s === 403), { statuses });
  }
  report.add('O-side-effect', 'negative: rejected mutations leave owner goal and logs unchanged',
    (await appPool.query('select count(*)::int n from goal')).rows[0].n === 1 && (await appPool.query('select count(*)::int n from action_log')).rows[0].n === 1);
  report.add('O-owner', 'negative: same-origin other user still gets 404 for every owner operation',
    (await B.call('GET', `/api/goals/${goal.json.id}`)).status === 404 && (await B.call('GET', `/api/goals/${goal.json.id}/today`)).status === 404 &&
    (await B.call('PUT', `/api/goals/${goal.json.id}/logs/2026-09-29`, { status: 'DONE', amount: 1 })).status === 404 && (await B.call('DELETE', `/api/goals/${goal.json.id}`)).status === 404);
  report.add('O-read', 'positive: safe GET with Cookie and no Origin remains allowed', (await fetch(stack.url + '/api/goals', { headers: { cookie: A.jar.header() } })).status === 200);
  for (const origin of ['http://127.0.0.2:3292', 'http://127.0.0.1:3291', 'null']) {
    report.add('A-' + origin, 'negative: existing auth sign-out Origin protection remains', (await A.call('POST', '/api/auth/sign-out', {}, { origin })).status === 403);
  }
  const safe = ['-9007199254740991', '0', '9007199254740991'];
  const safeRows: unknown[] = [];
  for (const value of safe) {
    const auth = (await authPool.query('select $1::int8 n', [value])).rows[0].n;
    const app = (await appPool.query('select $1::int8 n', [value])).rows[0].n;
    safeRows.push({ input: value, authType: typeof auth, appType: typeof app, exact: auth === Number(value) && app === value });
  }
  report.add('I-safe', 'positive: exact signed safe-integer boundaries in auth pool, app stays string', safeRows.every((r: any) => r.exact && r.authType === 'number' && r.appType === 'string'), safeRows);
  const unsafe: { input: string; rejected: boolean; appUnchanged: boolean }[] = [];
  for (const value of ['-9007199254740992', '9007199254740992', '-9223372036854775808', '9223372036854775807']) {
    let rejected = false; try { await authPool.query('select $1::int8 n', [value]); } catch (e) { rejected = e instanceof RangeError; }
    unsafe.push({ input: value, rejected, appUnchanged: (await appPool.query('select $1::int8 n', [value])).rows[0].n === value });
  }
  report.add('I-unsafe', 'negative: unsafe int8 never silently rounds; app pool preserves full strings', unsafe.every(r => r.rejected && r.appUnchanged), unsafe);
  const other = (await authPool.query("select 12::int4 i, 1.25::numeric n, '9007199254740992'::text t")).rows[0];
  report.add('I-other', 'positive: auth parser does not change other OIDs', other.i === 12 && other.n === '1.25' && other.t === '9007199254740992', { int4Type: typeof other.i, numericType: typeof other.n, textType: typeof other.t });
  const burst = await Promise.all(Array.from({ length: 20 }, async () => {
    const r = await fetch(stack!.url + '/api/auth/sign-in/email', { method: 'POST', headers: { origin: stack!.url, 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.150' }, body: JSON.stringify({ email: a.email, password: a.password + 'x' }) });
    await r.arrayBuffer(); return { status: r.status, retry: r.headers.get('x-retry-after') };
  }));
  report.add('I-rate', 'positive: dedicated default auth pool yields five 401 and fifteen 429, all waits integer 1..60',
    burst.filter(r => r.status === 401).length === 5 && burst.filter(r => r.status === 429).length === 15 && burst.filter(r => r.status === 429).every(r => /^\d+$/.test(r.retry ?? '') && Number(r.retry) >= 1 && Number(r.retry) <= 60),
    { statuses: burst.map(r => r.status), retries: [...new Set(burst.filter(r => r.status === 429).map(r => r.retry))] });
  try {
    const browser = await browserProbe(stack.url, { email: a.email, password: a.password }, serverTrace);
    report.info('Browser-environment', 'real browser scope and environment', { browser: 'browser' in browser ? browser.browser : null, unavailable: 'unavailable' in browser ? browser.unavailable : null, httpsTest: false });
    for (let n = 0; n < browser.checks.length; n++) { const c = browser.checks[n]; report.add('BR' + (n + 1), c.name, c.pass, c.detail); }
  } catch (e) { report.add('Browser-execution', 'existing isolated Chrome browser trial executes', false, { message: e instanceof Error ? e.message : 'browser failed' }); }
  const tables = ['user', 'account', 'session', 'goal', 'action_log'];
  const snapshot = new Map<string, Record<string, unknown>[]>();
  for (const table of tables) snapshot.set(table, (await appPool.query(`select * from "${table}"`)).rows);
  const oldCookieA = A.jar.header(), oldCookieB = B.jar.header();
  // Change password AFTER snapshot, to prove that restoration also rolls it back.
  const replacementPassword = newSecret();
  const changed = await A.call('POST', '/api/auth/change-password', { currentPassword: a.password, newPassword: replacementPassword, revokeOtherSessions: true });
  const changedLogin = await client(stack.url, stack.url).call('POST', '/api/auth/sign-in/email', { email: a.email, password: replacementPassword }, { 'x-forwarded-for': '198.51.100.152' });
  const oldLoginBefore = await client(stack.url, stack.url).call('POST', '/api/auth/sign-in/email', { email: a.email, password: a.password }, { 'x-forwarded-for': '198.51.100.153' });
  report.add('S-password-before', 'positive: post-snapshot password change accepts new and rejects old password before restore', changed.status === 200 && changedLogin.status === 200 && oldLoginBefore.status === 401,
    { change: changed.status, newPassword: changedLogin.status, oldPassword: oldLoginBefore.status });
  await A.call('POST', '/api/auth/sign-out', {});
  await appPool.query('delete from "user" where email=$1', [a.email]);
  report.add('S-before', 'positive: logged-out and deleted user old cookie is 401', (await fetch(stack.url + '/api/goals', { headers: { cookie: oldCookieA } })).status === 401);
  const cl = await appPool.connect();
  try {
    await cl.query('begin'); await cl.query('truncate "user" cascade');
    for (const table of tables) for (const row of snapshot.get(table)!) {
      const columns = Object.keys(row); const q = (s: string) => '"' + s.replaceAll('"', '""') + '"';
      await cl.query(`insert into ${q(table)} (${columns.map(q).join(',')}) values (${columns.map((_, i) => '$' + (i + 1)).join(',')})`, columns.map(k => row[k]));
    } await cl.query('commit');
  } catch (e) { await cl.query('rollback'); throw e; } finally { cl.release(); }
  report.add('S-risk-control', 'negative control: raw row restoration still revives logged-out old cookie', (await fetch(stack.url + '/api/goals', { headers: { cookie: oldCookieA } })).status === 200,
    { riskReproduced: true, restoreMode: 'logical in-memory replay, not Neon PITR' });
  const refused = spawnSync(process.execPath, [join(rootDir, 'verify', 'restore-revoke.ts')], { env: { PATH: process.env.PATH }, encoding: 'utf8', timeout: 15000, windowsHide: true });
  report.add('S-guard', 'negative: standalone restore revocation refuses missing explicit confirmation', refused.status === 1 && refused.stderr.includes('Refused'));
  const nonlocal = spawnSync(process.execPath, [join(rootDir, 'verify', 'restore-revoke.ts')], { env: { PATH: process.env.PATH, DATABASE_URL: 'postgres://synthetic:synthetic@db.invalid/unused', SPIKE_RESTORE_CONFIRM: 'isolated-restored-db' }, encoding: 'utf8', timeout: 15000, windowsHide: true });
  report.add('S-remote-guard', 'negative: confirmed restore CLI still refuses non-loopback without connecting', nonlocal.status === 1 && nonlocal.stderr.includes('Refused'));
  const revoked = spawnSync(process.execPath, [join(rootDir, 'verify', 'restore-revoke.ts')], { env: { PATH: process.env.PATH, DATABASE_URL: db.connectionString, SPIKE_RESTORE_CONFIRM: 'isolated-restored-db' }, encoding: 'utf8', timeout: 15000, windowsHide: true });
  let result: any; try { result = JSON.parse(revoked.stdout.trim()); } catch { result = null; }
  report.add('S-procedure', 'positive: confirmed standalone procedure removes all restored sessions', revoked.status === 0 && result?.deleted >= 2 && (await appPool.query('select count(*)::int n from session')).rows[0].n === 0, result);
  const after = await Promise.all([oldCookieA, oldCookieB].map(cookie => fetch(stack!.url + '/api/goals', { headers: { cookie } }).then(r => r.status)));
  report.add('S-cookies', 'positive: both restored old cookies rejected after revocation', after.every(s => s === 401), { statuses: after });
  report.add('S-unresolved-user', 'negative control: session revocation does not reapply user deletion', (await appPool.query('select count(*)::int n from "user" where email=$1', [a.email])).rows[0].n === 1,
    { userDeletionStillUnresolved: true });
  const relogin = await A.call('POST', '/api/auth/sign-in/email', { email: a.email, password: a.password }, { 'x-forwarded-for': '198.51.100.151' });
  report.add('S-unresolved-password', 'negative control: restored account password still authenticates', relogin.status === 200,
    { oldPasswordPolicyNotSolved: true, status: relogin.status });
  const newPasswordAfter = await client(stack.url, stack.url).call('POST', '/api/auth/sign-in/email', { email: a.email, password: replacementPassword }, { 'x-forwarded-for': '198.51.100.154' });
  report.add('S-password-rollback', 'negative control: password changed after snapshot is rejected after restore and session purge', newPasswordAfter.status === 401, { status: newPasswordAfter.status, passwordRollbackStillUnresolved: true });
  const summary = report.save('v5-fixed-regression.json', { provisionalPolicy: 'same-origin mutation only; null/missing rejected', realEngine: false, restoreMode: 'in-memory logical rows; offline session revocation' });
  failed = summary.fail > 0;
} finally {
  if (stack) await stack.stop(); await appPool.end(); await authPool.end(); await db.stop();
}
// embedded-postgres exit hooks can mask process.exitCode; force final assertion status.
process.exit(failed ? 1 : 0);
