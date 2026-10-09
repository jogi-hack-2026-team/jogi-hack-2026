// 認証つきのAPI全体（guards → 業務route）をテストするための共通部品。
import { randomBytes, randomUUID } from 'node:crypto';
import type test from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.ts';
import { createAuth } from '../../src/auth/options.ts';
import { migrate } from '../../src/db/migrate.ts';
import { createAuthPool } from '../../src/db/pool.ts';
import { createTestDatabase, type TestDatabase } from './database.ts';

export type CookieShape = { name: string; attributes: string[] };
// Cookie値はSecretなので、属性だけを比較する。
export const cookieShape = (line: string): CookieShape => {
  const [pair = '', ...attrs] = line.split(';');
  return { name: pair.slice(0, pair.indexOf('=')).trim(), attributes: attrs.map((a) => a.trim().toLowerCase()) };
};

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// ブラウザのように、Set-Cookieを保持して次の要求へ付け、Originヘッダーを送るclient。
export class Client {
  private readonly displayedGoals = new Map<string, Record<string, unknown>>();
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
  // 既存機能の回帰は取得済みDTOを表示中のclientとして必須値を送る。
  // 新しいGETを暗黙に差し込まない（snapshot/時計/行lockの観測を変えない）。
  // 欠落・stale CAS・同キー再送のnegative oracleはrawCallで送信内容を固定する。
  async call(method: Method, url: string, body?: unknown, headers: Record<string, string> = {}) {
    const path = url.split('?')[0]!;
    if (method === 'POST' && path === '/api/goals') headers = { 'idempotency-key': randomUUID(), ...headers };
    const match = /^\/api\/goals\/([^/]+)(?:\/logs\/[^/]+)?$/.exec(path);
    if (match && (method === 'PATCH' || method === 'PUT') && body && typeof body === 'object' && Object.keys(body).length > 0) {
      const current = this.displayedGoals.get(match[1]!);
      const input = body as Record<string, unknown>;
      body = { expectedGoalSettingsRevision: current?.goalSettingsRevision ?? 0,
        ...(method === 'PUT' && input.status === 'DONE' && !Object.hasOwn(input, 'amount') ? { amount: current?.sessionAmount ?? 10 } : {}), ...input };
    }
    const result = await this.rawCall(method, url, body, headers);
    const keep = (dto: Record<string, unknown> | null) => {
      if (dto && typeof dto.id === 'string' && typeof dto.goalSettingsRevision === 'number') this.displayedGoals.set(dto.id, dto);
    };
    if (result.status === 200 || result.status === 201) {
      if (Array.isArray(result.json)) for (const dto of result.json) keep(dto);
      else keep(result.json);
    }
    return result;
  }
  async rawCall(method: Method, url: string, body?: unknown, headers: Record<string, string> = {}) {
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
    return { status: res.statusCode, json: json as Record<string, unknown> | null, body: res.body, setCookie, headers: res.headers };
  }
}

export type Stack = { app: FastifyInstance; close: () => Promise<void> };
export type StackOptions = { baseURL?: string; signInMax?: number; trustProxyHops?: number; now?: () => Date };

export async function startStack(db: TestDatabase, o: StackOptions = {}): Promise<Stack> {
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
    ...(o.now ? { now: o.now } : {}),
  });
  return {
    app,
    close: async () => {
      await app.close();
      await authPool.end();
    },
  };
}

export const credentials = (tag: string) => ({
  name: `user ${tag}`,
  email: `${tag}-${randomBytes(4).toString('hex')}@example.test`,
  password: randomBytes(18).toString('base64url'),
});

// テストごとに専用DB・migration済み・認証つきアプリを用意し、終了時に片付ける。
export async function setup(t: test.TestContext, o: StackOptions = {}) {
  const db = await createTestDatabase();
  await migrate(db.pool);
  const stack = await startStack(db, o);
  t.after(async () => {
    await stack.close();
    await db.close();
  });
  return { db, stack };
}

/** 登録してログイン済みのclientを返す。 */
export async function signedInClient(app: FastifyInstance, tag: string, origin = 'http://127.0.0.1:3000'): Promise<Client> {
  const client = new Client(app, origin);
  const res = await client.call('POST', '/api/auth/sign-up/email', credentials(tag));
  if (res.status !== 200) throw new Error(`sign-up failed: ${res.status} ${res.body}`);
  return client;
}
