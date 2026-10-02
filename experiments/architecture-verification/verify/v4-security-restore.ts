// Supporting Artifact. Only two synthetic identities; isolated, fresh loopback DB.
// In-memory logical snapshot replay is NOT Neon PITR or pg_dump/pg_restore validation.
import { startPg } from '../src/pg-embedded.ts';
import { createPool } from '../src/pool.ts';
import { createAuth } from '../src/auth.ts';
import { migrate } from '../src/migrate.ts';
import { client, cookieShape, goalInput, newCredentials, newSecret, Report, startStack } from './lib.ts';

const report = new Report('additional auth, Origin and logical restore probes');
const db = await startPg({ name: 'v4', port: 55590, fresh: true });
const pool = createPool({ connectionString: db.connectionString, max: 5, int8: 'number' });
const secret = newSecret();
let stack: Awaited<ReturnType<typeof startStack>> | undefined;
try {
  await migrate(pool, createAuth({ pool, secret, baseURL: 'http://127.0.0.1:3280' }));
  stack = await startStack({ connectionString: db.connectionString, port: 3280, secret,
    trustProxyHops: 1, auth: { pool, signInMax: 5, signUpMax: 5, generalMax: 1000 } });
  const A = client(stack.url, stack.url), B = client(stack.url, stack.url);
  const a = newCredentials(), b = newCredentials();
  await A.call('POST', '/api/auth/sign-up/email', a);
  await B.call('POST', '/api/auth/sign-up/email', b);
  const g = await A.call('POST', '/api/goals', goalInput('synthetic restore probe'));
  report.add('X1', 'exactly two synthetic users exist', (await pool.query('select count(*)::int n from "user"')).rows[0].n === 2);
  const other = await B.call('GET', `/api/goals/${g.json.id}`);
  report.add('X2', 'another user cannot read the owner goal', other.status === 404, { status: other.status });
  const sameSiteOtherOrigin = 'http://127.0.0.1:3281'; // same scheme/host, different port = distinct origin
  const authReject = await A.call('POST', '/api/auth/sign-out', {}, { origin: sameSiteOtherOrigin });
  report.add('X3', 'auth rejects cookie-bearing same-site distinct Origin', authReject.status === 403, { status: authReject.status });
  const appAccept = await A.call('POST', '/api/goals', goalInput('foreign-origin synthetic'), { origin: sameSiteOtherOrigin });
  report.info('X4', 'app mutation with same-site distinct Origin', { status: appAccept.status,
    blocker: appAccept.status === 201, browserTest: false, note: 'Cookie explicitly sent by Node; does not test browser SameSite, CORS or form/content-type exploitability.' });
  const nullOrigin = await A.call('POST', '/api/auth/sign-out', {}, { origin: 'null' });
  report.add('X5', 'auth rejects Origin null', nullOrigin.status === 403, { status: nullOrigin.status });
  const expiredCookie = B.jar.header();
  await pool.query('update session set "expiresAt" = now() - interval \'1 minute\' where "userId" = (select id from "user" where email = $1)', [b.email]);
  const expired = await fetch(stack.url + '/api/goals', { headers: { cookie: expiredCookie } });
  report.add('X6', 'expired DB session cookie is rejected', expired.status === 401, { status: expired.status });

  // Repeated small bursts with distinct documentation-only IP buckets. No external traffic.
  const rounds: { processed: number; limited: number; retryValid: boolean }[] = [];
  for (let n = 1; n <= 10; n++) {
    const results = await Promise.all(Array.from({ length: 20 }, async () => {
      const r = await fetch(stack!.url + '/api/auth/sign-in/email', { method: 'POST',
        headers: { origin: stack!.url, 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${100+n}` },
        body: JSON.stringify({ email: a.email, password: a.password + 'x' }) });
      await r.arrayBuffer();
      return { status: r.status, retry: r.headers.get('x-retry-after') };
    }));
    rounds.push({ processed: results.filter(r => r.status === 401).length,
      limited: results.filter(r => r.status === 429).length,
      retryValid: results.filter(r => r.status === 429).every(r => /^\d+$/.test(r.retry ?? '') && Number(r.retry) >= 1 && Number(r.retry) <= 60) });
  }
  report.add('X7', 'ten bursts of twenty attempts obey max five; integer wait headers', rounds.every(r => r.processed === 5 && r.limited === 15 && r.retryValid), rounds);

  const tables = ['user', 'account', 'session', 'goal', 'action_log'];
  // Snapshot is held only in memory and never written to result files or logs.
  const snapshot = new Map<string, Record<string, unknown>[]>();
  for (const table of tables) snapshot.set(table, (await pool.query(`select * from "${table}"`)).rows);
  const oldCookie = A.jar.header();
  const out = await A.call('POST', '/api/auth/sign-out', {});
  report.add('X8', 'all logout Set-Cookie lines retain separate attributes', out.status === 200 && out.setCookie.length >= 2,
    { status: out.status, lines: out.setCookie.length, shapes: out.setCookie.map(cookieShape) });
  const afterLogout = await fetch(stack.url + '/api/goals', { headers: { cookie: oldCookie } });
  report.add('X9', 'old cookie rejected before logical restoration', afterLogout.status === 401, { status: afterLogout.status });
  await pool.query('delete from "user" where email = $1', [a.email]);
  report.add('X10', 'deleted synthetic user is absent', (await pool.query('select count(*)::int n from "user" where email = $1', [a.email])).rows[0].n === 0);
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query('truncate "user" cascade');
    for (const table of tables) for (const row of snapshot.get(table)!) {
      const columns = Object.keys(row);
      const quote = (v: string) => '"' + v.replaceAll('"', '""') + '"';
      await c.query(`insert into ${quote(table)} (${columns.map(quote).join(',')}) values (${columns.map((_, i) => '$' + (i + 1)).join(',')})`, columns.map(k => row[k]));
    }
    await c.query('commit');
  } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
  report.add('X11', 'logical restoration resurrects the previously deleted synthetic user', (await pool.query('select count(*)::int n from "user" where email = $1', [a.email])).rows[0].n === 1);
  const afterRestore = await fetch(stack.url + '/api/goals', { headers: { cookie: oldCookie } });
  report.add('X12', 'logical restoration revives logged-out session with unchanged signing secret', afterRestore.status === 200,
    { status: afterRestore.status, riskConfirmed: afterRestore.status === 200, mechanism: 'replay of pre-revocation rows; NOT provider PITR validation' });
  await pool.query('delete from session');
  const afterRevoke = await fetch(stack.url + '/api/goals', { headers: { cookie: oldCookie } });
  report.add('X13', 'purging restored DB sessions rejects old cookie again', afterRevoke.status === 401, { status: afterRevoke.status });
  const summary = report.save('v4-security-restore.json', { browserTest: false, restoreMode: 'in-memory logical row snapshot', realEngine: false });
  if (summary.fail) process.exitCode = 1;
} finally {
  if (stack) await stack.stop();
  await pool.end();
  await db.stop();
}
