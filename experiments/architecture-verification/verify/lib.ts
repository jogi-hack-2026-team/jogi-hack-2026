// Supporting Artifact / Not a Source of Truth (Issue #84).
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { buildApp, TRUSTED_IP_HEADER, type AppConfig } from '../src/app.ts';
import { createAuth, type AuthConfig } from '../src/auth.ts';
import { rootDir } from '../src/pg-embedded.ts';

export type Check = { id: string; name: string; status: 'PASS' | 'FAIL' | 'INFO'; detail?: unknown };

export class Report {
  checks: Check[] = [];
  title: string;
  constructor(title: string) {
    this.title = title;
  }
  add(id: string, name: string, pass: boolean, detail?: unknown) {
    this.checks.push({ id, name, status: pass ? 'PASS' : 'FAIL', detail });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}`);
  }
  info(id: string, name: string, detail: unknown) {
    this.checks.push({ id, name, status: 'INFO', detail });
    console.log(`INFO  ${id}  ${name}`);
  }
  save(file: string, extra: Record<string, unknown> = {}) {
    mkdirSync(join(rootDir, 'results'), { recursive: true });
    const summary = {
      pass: this.checks.filter((c) => c.status === 'PASS').length,
      fail: this.checks.filter((c) => c.status === 'FAIL').length,
      info: this.checks.filter((c) => c.status === 'INFO').length,
    };
    writeFileSync(
      join(rootDir, 'results', file),
      JSON.stringify({ label: 'Supporting Artifact / Not a Source of Truth', title: this.title, at: new Date().toISOString(), environment: environment(), summary, ...extra, checks: this.checks }, null, 2) + '\n',
    );
    console.log(`\n${this.title}: ${summary.pass} pass, ${summary.fail} fail, ${summary.info} info -> results/${file}`);
    return summary;
  }
}

export function environment() {
  return {
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    totalMemGb: Math.round((totalmem() / 1073741824) * 10) / 10,
  };
}

/** Generated per run; never printed or written to results. */
export function newCredentials() {
  const id = randomBytes(6).toString('hex');
  return { name: `Spike ${id}`, email: `u-${id}@spike.test`, password: randomBytes(18).toString('base64url') };
}

export class CookieJar {
  cookies = new Map<string, string>();
  absorb(res: Response) {
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const maxAge = attrs.map((a) => a.trim().toLowerCase()).find((a) => a.startsWith('max-age='));
      if (value === '' || maxAge === 'max-age=0') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

/** Cookie attributes without the value (values are secrets). */
export function cookieShape(line: string) {
  const [pair, ...attrs] = line.split(';');
  const name = pair.slice(0, pair.indexOf('=')).trim();
  return { name, attributes: attrs.map((a) => a.trim()).map((a) => (a.toLowerCase().startsWith('expires=') ? 'Expires=<date>' : a)) };
}

export type Stack = {
  url: string;
  pool: pg.Pool;
  app: Awaited<ReturnType<typeof buildApp>>;
  auth: ReturnType<typeof createAuth>;
  stop: () => Promise<void>;
};

export async function startStack(o: {
  connectionString: string;
  port: number;
  baseURL?: string;
  bridge?: AppConfig['bridge'];
  ajvMode?: AppConfig['ajvMode'];
  trustProxyHops?: number;
  auth?: Partial<AuthConfig>;
  predict?: AppConfig['predict'];
  secret: string;
  webDist?: string;
  poolMax?: number;
}): Promise<Stack> {
  const url = `http://127.0.0.1:${o.port}`;
  const baseURL = o.baseURL ?? url;
  const bridge = o.bridge ?? 'hardened';
  const pool = new pg.Pool({ connectionString: o.connectionString, max: o.poolMax ?? 5 });
  const auth = createAuth({
    pool,
    secret: o.secret,
    baseURL,
    ipHeader: bridge === 'hardened' ? TRUSTED_IP_HEADER : 'x-forwarded-for',
    ...o.auth,
  });
  const app = await buildApp({
    pool,
    auth,
    baseURL,
    bridge,
    ajvMode: o.ajvMode ?? 'strict',
    trustProxyHops: o.trustProxyHops ?? 0,
    predict: o.predict ?? { burnMs: 0, mode: 'inline', workers: 0 },
    metrics: false,
    webDist: o.webDist,
    logger: false,
  });
  await app.listen({ port: o.port, host: '127.0.0.1' });
  return {
    url,
    pool,
    app,
    auth,
    stop: async () => {
      await app.close();
      await pool.end();
    },
  };
}

export function client(base: string, origin: string) {
  const jar = new CookieJar();
  async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(jar.cookies.size ? { cookie: jar.header() } : {}),
        origin,
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    jar.absorb(res);
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { nonJson: text.slice(0, 80) };
    }
    return { status: res.status, json, res, setCookie: res.headers.getSetCookie() };
  }
  return { jar, call };
}

export const goalInput = (title = 'spike goal') => ({
  title,
  unit: 'minutes',
  totalRequired: 6000,
  sessionAmount: 30,
  initialProgress: 0,
  timezone: 'Asia/Tokyo',
});

export const newSecret = () => randomBytes(32).toString('base64url');
