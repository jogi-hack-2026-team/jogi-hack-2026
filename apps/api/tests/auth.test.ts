import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { createAuth } from '../src/auth/options.ts';
import { migrate } from '../src/db/migrate.ts';
import { createAuthPool } from '../src/db/pool.ts';
import { createTestDatabase, type TestDatabase } from './helpers/database.ts';

// Cookie値はSecretなので、属性だけを比較する。
type CookieShape = { name: string; attributes: string[] };
const cookieShape = (line: string): CookieShape => {
  const [pair = '', ...attrs] = line.split(';');
  return { name: pair.slice(0, pair.indexOf('=')).trim(), attributes: attrs.map((a) => a.trim().toLowerCase()) };
};

class Client {
  readonly cookies = new Map<string, string>();
  private readonly app: FastifyInstance;
  private readonly origin: string | null;
  constructor(app: FastifyInstance, origin: string | null) {
    this.app = app;
    this.origin = origin;
  }
  cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  async call(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await this.app.inject({
      method,
      url,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(this.cookies.size ? { cookie: this.cookieHeader() } : {}),
        ...(this.origin ? { origin: this.origin } : {}),
        ...headers,
      },
      ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
    });
    const raw = res.headers['set-cookie'];
    const setCookie = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
    for (const line of setCookie) {
      const { name, attributes } = cookieShape(line);
      const value = line.slice(line.indexOf('=') + 1).split(';')[0]?.trim() ?? '';
      if (value === '' || attributes.includes('max-age=0')) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    let json: unknown = null;
    try {
      json = res.body ? JSON.parse(res.body) : null;
    } catch {
      json = null;
    }
    return { status: res.statusCode, json: json as Record<string, unknown> | null, setCookie, headers: res.headers };
  }
}

type Stack = { app: FastifyInstance; close: () => Promise<void> };

async function startStack(db: TestDatabase, o: { baseURL?: string; signInMax?: number; trustProxyHops?: number } = {}): Promise<Stack> {
  const baseURL = o.baseURL ?? 'http://127.0.0.1:3000';
  const authPool = createAuthPool({ connectionString: db.connectionString, max: 2 });
  const auth = createAuth({
    pool: authPool,
    secret: randomBytes(32).toString('base64url'),
    baseURL,
    signInMax: o.signInMax ?? 50,
    signUpMax: 50,
  });
  const app = await buildApp({
    pool: db.pool,
    logger: false,
    auth: { instance: auth, baseURL, allowedOrigins: [baseURL], trustProxyHops: o.trustProxyHops ?? 0 },
  });
  return {
    app,
    close: async () => {
      await app.close();
      await authPool.end();
    },
  };
}

const credentials = (tag: string) => ({ name: `user ${tag}`, email: `${tag}-${randomBytes(4).toString('hex')}@example.test`, password: randomBytes(18).toString('base64url') });

async function setup(t: test.TestContext, o: Parameters<typeof startStack>[1] = {}) {
  const db = await createTestDatabase();
  await migrate(db.pool);
  const stack = await startStack(db, o);
  t.after(async () => {
    await stack.close();
    await db.close();
  });
  return { db, stack };
}

test('未ログインでは /api/goals を含む /api/* が401、/api/health だけ公開', async (t) => {
  const { stack } = await setup(t);
  const anon = new Client(stack.app, 'http://127.0.0.1:3000');
  for (const [method, url, body] of [
    ['GET', '/api/goals'],
    ['POST', '/api/goals', { title: 'x' }],
    ['GET', '/api/goals/00000000-0000-4000-8000-000000000000/today'],
    ['PUT', '/api/goals/00000000-0000-4000-8000-000000000000/logs/2026-10-05', { status: 'SKIPPED' }],
  ] as const) {
    const res = await anon.call(method, url, body);
    assert.equal(res.status, 401, `${method} ${url}`);
    assert.deepEqual(res.json, { error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' } });
  }
  assert.equal((await anon.call('GET', '/api/health')).status, 200);
});

test('登録→セッション→再読み込み→ログアウト→古いCookieは401', async (t) => {
  const { stack } = await setup(t);
  const origin = 'http://127.0.0.1:3000';
  const a = new Client(stack.app, origin);
  const cred = credentials('a');

  const signUp = await a.call('POST', '/api/auth/sign-up/email', cred);
  assert.equal(signUp.status, 200);
  const session = signUp.setCookie.map(cookieShape).find((c) => c.name.endsWith('session_token'));
  assert.ok(session, 'session cookie set');
  assert.ok(session.attributes.includes('httponly') && session.attributes.includes('samesite=lax') && session.attributes.includes('path=/'));
  assert.ok(!session.attributes.includes('secure'), 'plain http base URL has no Secure flag');

  const me = await a.call('GET', '/api/auth/get-session');
  assert.equal(me.status, 200);
  assert.equal((me.json?.user as { email: string }).email, cred.email);

  // 再読み込み: Cookieだけを持つ新しい要求でも保護APIを通過する（routeがないので404、401ではない）
  const reload = await stack.app.inject({ method: 'GET', url: '/api/goals', headers: { cookie: a.cookieHeader() } });
  assert.equal(reload.statusCode, 404);
  assert.equal(reload.json().error.code, 'NOT_FOUND');

  const oldCookie = a.cookieHeader();
  const signOut = await a.call('POST', '/api/auth/sign-out', {});
  assert.equal(signOut.status, 200);
  assert.ok(signOut.setCookie.length >= 1, 'sign-out clears cookies');
  assert.equal(a.cookies.size, 0);
  const replay = await stack.app.inject({ method: 'GET', url: '/api/goals', headers: { cookie: oldCookie } });
  assert.equal(replay.statusCode, 401, 'revoked session cookie is rejected');

  const wrong = await a.call('POST', '/api/auth/sign-in/email', { email: cred.email, password: cred.password + 'x' });
  assert.equal(wrong.status, 401);
  const again = await a.call('POST', '/api/auth/sign-in/email', { email: cred.email, password: cred.password });
  assert.equal(again.status, 200);
  assert.ok(a.cookies.size > 0);
});

test('期限切れセッションは401になり、画面側が再ログインへ誘導できる', async (t) => {
  const { db, stack } = await setup(t);
  const a = new Client(stack.app, 'http://127.0.0.1:3000');
  await a.call('POST', '/api/auth/sign-up/email', credentials('exp'));
  assert.equal((await stack.app.inject({ method: 'GET', url: '/api/goals', headers: { cookie: a.cookieHeader() } })).statusCode, 404);
  await db.pool.query(`update session set "expiresAt" = now() - interval '1 minute'`);
  assert.equal((await stack.app.inject({ method: 'GET', url: '/api/goals', headers: { cookie: a.cookieHeader() } })).statusCode, 401);
  assert.equal((await a.call('GET', '/api/auth/get-session')).json, null);
});

test('別originからの認証要求と、Cookie付きの状態変更要求は拒否する', async (t) => {
  const { stack } = await setup(t);
  const origin = 'http://127.0.0.1:3000';
  const a = new Client(stack.app, origin);
  const cred = credentials('csrf');
  await a.call('POST', '/api/auth/sign-up/email', cred);

  const evil = new Client(stack.app, 'http://evil.example');
  assert.equal((await evil.call('POST', '/api/auth/sign-in/email', { email: cred.email, password: cred.password })).status, 403);

  const cookie = a.cookieHeader();
  const foreignAuth = await stack.app.inject({ method: 'POST', url: '/api/auth/sign-out', headers: { cookie, origin: 'http://evil.example', 'content-type': 'application/json' }, payload: '{}' });
  assert.equal(foreignAuth.statusCode, 403, 'auth endpoint rejects foreign Origin even with a valid cookie');

  const foreignApi = await stack.app.inject({ method: 'POST', url: '/api/goals', headers: { cookie, origin: 'http://evil.example', 'content-type': 'application/json' }, payload: '{}' });
  assert.equal(foreignApi.statusCode, 403);
  assert.equal(foreignApi.json().error.code, 'ORIGIN_REJECTED');
  // same-site別origin（port違い）も拒否
  const sameSite = await stack.app.inject({ method: 'POST', url: '/api/goals', headers: { cookie, origin: 'http://127.0.0.1:5174', 'content-type': 'application/json' }, payload: '{}' });
  assert.equal(sameSite.statusCode, 403);
  // Originなし（非ブラウザ）も状態変更は拒否、読み取りは通す
  assert.equal((await stack.app.inject({ method: 'POST', url: '/api/goals', headers: { cookie, 'content-type': 'application/json' }, payload: '{}' })).statusCode, 403);
  assert.equal((await stack.app.inject({ method: 'GET', url: '/api/goals', headers: { cookie } })).statusCode, 404);
  // 正規のoriginなら保護hookを通過する（routeがないので404）
  assert.equal((await a.call('POST', '/api/goals', {})).status, 404);
  // セッションはそのまま残っている
  assert.equal((await a.call('GET', '/api/auth/get-session')).status, 200);
});

test('https のbase URLでは session cookie が Secure かつ __Secure- 接頭辞になる', async (t) => {
  const { stack } = await setup(t, { baseURL: 'https://app.example.test' });
  const a = new Client(stack.app, 'https://app.example.test');
  const signUp = await a.call('POST', '/api/auth/sign-up/email', credentials('tls'));
  assert.equal(signUp.status, 200);
  const session = signUp.setCookie.map(cookieShape).find((c) => c.name.endsWith('session_token'));
  assert.ok(session?.attributes.includes('secure'));
  assert.ok(session?.name.startsWith('__Secure-'));
  const plainOrigin = new Client(stack.app, 'http://app.example.test');
  assert.equal((await plainOrigin.call('POST', '/api/auth/sign-in/email', { email: 'x@example.test', password: 'whatever-password' })).status, 403);
});

test('認証の回数制限はDBに保存され、再起動（別instance）後も続き、待ち時間は整数秒で返る', async (t) => {
  const { db, stack } = await setup(t, { signInMax: 3, trustProxyHops: 1 });
  const origin = 'http://127.0.0.1:3000';
  const a = new Client(stack.app, origin);
  const cred = credentials('rl');
  await a.call('POST', '/api/auth/sign-up/email', cred);
  await a.call('POST', '/api/auth/sign-out', {});

  const attempt = (app: FastifyInstance, xff: string, password = 'wrong-password-value') =>
    new Client(app, origin).call('POST', '/api/auth/sign-in/email', { email: cred.email, password }, { 'x-forwarded-for': xff });
  const retryAfter = (r: { headers: Record<string, unknown> }) => String(r.headers['x-retry-after'] ?? '');
  const validRetryAfter = (v: string) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 60;

  const statuses: number[] = [];
  let last: Awaited<ReturnType<typeof attempt>> | undefined;
  for (let i = 0; i < 5; i++) {
    // 偽装した左端のアドレスを変えても、信頼hopで決まる右端（203.0.113.5）が鍵になる
    last = await attempt(stack.app, `9.9.9.${i}, 203.0.113.5`);
    statuses.push(last.status);
  }
  assert.deepEqual(statuses, [401, 401, 401, 429, 429]);
  assert.ok(last && validRetryAfter(retryAfter(last)), `X-Retry-After=${last && retryAfter(last)}`);
  const correct = await attempt(stack.app, '203.0.113.5', cred.password);
  assert.equal(correct.status, 429, 'while limited, even the correct password is refused');
  const stored = await db.pool.query('select count(*)::int as n from "rateLimit"');
  assert.ok((stored.rows[0]?.n as number) >= 1, 'limit is stored in PostgreSQL');

  // 別のIPは影響を受けない
  assert.equal((await attempt(stack.app, '198.51.100.7')).status, 401);

  // 再起動: 同じDBで新しいinstanceを作っても制限が続く
  const restarted = await startStack(db, { signInMax: 3, trustProxyHops: 1 });
  try {
    const afterRestart = await attempt(restarted.app, '203.0.113.5', cred.password);
    assert.equal(afterRestart.status, 429);
    assert.ok(validRetryAfter(retryAfter(afterRestart)));
    assert.ok(Number(retryAfter(afterRestart)) <= Number(retryAfter(last!)), 'the advertised wait does not grow');
  } finally {
    await restarted.close(); // DBを閉じる前に別instanceを止める
  }
});
