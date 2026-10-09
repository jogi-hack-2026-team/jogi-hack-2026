import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { buildApp } from '../src/app.ts';
import { Client, credentials, setup } from './helpers/stack.ts';

test('私的APIの成功・404・500・router拒否は保存禁止、handlerのcache指定でも緩めない', async (t) => {
  // 応答hookだけの検査。DBへは接続しない。
  const pool = new pg.Pool({ connectionString: 'postgres://nobody:nothing@127.0.0.1:1/none' });
  const app = await buildApp({ pool, logger: false });
  t.after(async () => { await app.close(); await pool.end(); });
  app.get('/api/cache-probe', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=3600');
    return { fixture: true };
  });
  app.get('/api/failure-probe', async () => { throw new Error('synthetic failure'); });

  for (const [url, expected] of [
    ['/api/cache-probe?view=r11', 200],
    ['/api/unknown', 404],
    ['/api%2Funknown', 404],
    ['/api/failure-probe', 500],
    ['/api/goals/%E0%A4%A', 400],
  ] as const) {
    const response = await app.inject({ method: 'GET', url });
    assert.equal(response.statusCode, expected, url);
    assert.equal(response.headers['cache-control'], 'no-store', url);
  }
  const head = await app.inject({ method: 'HEAD', url: '/api/cache-probe' });
  assert.equal(head.statusCode, 200);
  assert.equal(head.headers['cache-control'], 'no-store');
  assert.equal(head.body, '');
  const outside = await app.inject({ method: 'GET', url: '/unknown' });
  assert.equal(outside.statusCode, 404);
  assert.equal(outside.headers['cache-control'], undefined);
});

test('実Goal・Log・Today・authの成功と拒否応答にno-storeを付け、所有者・DB・Cookieを保全する', async (t) => {
  const { db, stack } = await setup(t, { now: () => new Date('2026-10-09T12:00:00Z') });
  const origin = 'http://127.0.0.1:3000';
  const a = new Client(stack.app, origin);
  const b = new Client(stack.app, origin);
  const anon = new Client(stack.app, origin);
  const credentialA = credentials('cache-a');
  const credentialB = credentials('cache-b');
  const check = (response: { status: number; headers: Record<string, unknown> }, status: number) => {
    assert.equal(response.status, status);
    assert.equal(response.headers['cache-control'], 'no-store');
  };
  for (const [client, credential] of [[a, credentialA], [b, credentialB]] as const) {
    const signup = await client.call('POST', '/api/auth/sign-up/email', credential);
    check(signup, 200);
    assert.ok(signup.setCookie.length > 0, 'registration still forwards cookies');
  }
  const create = await a.call('POST', '/api/goals', {
    title: 'synthetic owner A', unit: 'minutes', totalRequired: 200, sessionAmount: 10,
    initialProgress: 0, timezone: 'UTC', questionPrior: { a: 'LOW', b: 'HIGH' },
  });
  check(create, 201);
  const goalId = create.json!.id as string;
  const date = create.json!.today as string;
  check(await a.call('PUT', `/api/goals/${goalId}/logs/${date}`, { status: 'DONE', amount: 13 }), 200);
  for (const url of ['/api/goals', `/api/goals/${goalId}`, `/api/goals/${goalId}?view=r11`,
    `/api/goals/${goalId}/logs`, `/api/goals/${goalId}/today`, `/api/goals/${goalId}/today?view=r11`]) {
    check(await a.call('GET', url), 200);
  }
  const session = await a.call('GET', '/api/auth/get-session');
  check(session, 200);
  assert.equal(session.headers.pragma, 'no-cache');
  assert.equal((session.json!.user as { email: string }).email, credentialA.email);
  const snapshot = async () => (await db.pool.query(`select json_build_object(
    'goals', coalesce((select json_agg(g order by id) from goal g), '[]'::json),
    'logs', coalesce((select json_agg(l order by goal_id, local_date) from action_log l), '[]'::json)) as data`)).rows[0]!.data;
  const before = await snapshot();
  for (const [method, url, body] of [
    ['GET', `/api/goals/${goalId}`], ['GET', `/api/goals/${goalId}?view=r11`],
    ['PATCH', `/api/goals/${goalId}`, { title: 'must not change' }], ['DELETE', `/api/goals/${goalId}`],
    ['GET', `/api/goals/${goalId}/logs`], ['PUT', `/api/goals/${goalId}/logs/${date}`, { status: 'SKIPPED' }],
    ['GET', `/api/goals/${goalId}/today`], ['GET', `/api/goals/${goalId}/today?view=r11`],
  ] as const) {
    const response = await b.call(method, url, body);
    check(response, 404);
    assert.equal((response.json!.error as { code: string }).code, 'NOT_FOUND');
    assert.deepEqual(await snapshot(), before, `${method} ${url} leaves Goal/log data unchanged`);
  }
  const rejected = await anon.call('GET', '/api/goals');
  check(rejected, 401);
  assert.equal((rejected.json!.error as { code: string }).code, 'UNAUTHENTICATED');
  const foreign = await a.call('PATCH', `/api/goals/${goalId}`, { title: 'must not change' }, { origin: 'http://other.example.test' });
  check(foreign, 403);
  assert.equal((foreign.json!.error as { code: string }).code, 'ORIGIN_REJECTED');
  check(await a.call('POST', '/api/goals', {}), 422);
  check(await anon.call('POST', '/api/auth/sign-in/email', { email: credentialA.email, password: credentialA.password + 'x' }), 401);
  check(await b.call('POST', '/api/auth/sign-out', {}, { origin: 'http://other.example.test' }), 403);
  assert.deepEqual(await snapshot(), before);

  // 公開healthは保存禁止の対象へ巻き込まない。
  const health = await anon.call('GET', '/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.headers['cache-control'], undefined);
  check(await a.call('PATCH', `/api/goals/${goalId}`, { title: 'synthetic owner A updated' }), 200);
  check(await a.call('DELETE', `/api/goals/${goalId}`), 204);
  const oldCookie = b.cookieHeader();
  const logout = await b.call('POST', '/api/auth/sign-out', {});
  check(logout, 200);
  assert.ok(logout.setCookie.length > 0, 'logout still forwards clearing cookies');
  check(await anon.call('GET', '/api/goals', undefined, { cookie: oldCookie }), 401);
  const login = await b.call('POST', '/api/auth/sign-in/email', { email: credentialB.email, password: credentialB.password });
  check(login, 200);
  assert.ok(login.setCookie.length > 0, 'sign-in still forwards cookies');
});
