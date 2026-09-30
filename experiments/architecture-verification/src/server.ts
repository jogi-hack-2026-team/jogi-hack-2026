// Supporting Artifact / Not a Source of Truth (Issue #84).
// One process: API + (optionally) the built SPA from the same origin.
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import pg from 'pg';
import { buildApp } from './app.ts';
import { createAuth } from './auth.ts';
import { migrate } from './migrate.ts';
import { localDir } from './paths.ts';
import type { PgHandle } from './pg-embedded.ts';
import { TRUSTED_IP_HEADER } from './app.ts';

const env = process.env;
const port = Number(env.PORT ?? 3084);
const host = env.HOST ?? '127.0.0.1';
const baseURL = env.BASE_URL ?? `http://localhost:${port}`;
const bridge = (env.SPIKE_BRIDGE ?? 'hardened') as 'docs' | 'hardened';

function localSecret(): string {
  // Local-only development secret, generated once and kept out of Git.
  mkdirSync(localDir, { recursive: true });
  const f = join(localDir, 'auth-secret');
  if (!existsSync(f)) writeFileSync(f, randomBytes(32).toString('base64url'), { mode: 0o600 });
  return readFileSync(f, 'utf8');
}

let embedded: PgHandle | undefined;
let databaseUrl = env.DATABASE_URL;
if (!databaseUrl) {
  // Loaded only when no DATABASE_URL is given: embedded-postgres installs its own signal hooks.
  const { startPg } = await import('./pg-embedded.ts');
  embedded = await startPg({ name: env.SPIKE_PG_NAME ?? 'main', fresh: env.SPIKE_PG_FRESH === '1' });
  databaseUrl = embedded.connectionString;
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: Number(env.PG_POOL_MAX ?? 5) });
const auth = createAuth({
  pool,
  secret: env.BETTER_AUTH_SECRET ?? localSecret(),
  baseURL,
  rateLimitStorage: (env.SPIKE_RATE_LIMIT_STORAGE ?? 'database') as 'database' | 'memory',
  ipHeader: bridge === 'hardened' ? TRUSTED_IP_HEADER : 'x-forwarded-for',
  signInMax: env.SPIKE_SIGNIN_MAX ? Number(env.SPIKE_SIGNIN_MAX) : undefined,
  signUpMax: env.SPIKE_SIGNUP_MAX ? Number(env.SPIKE_SIGNUP_MAX) : undefined,
  generalMax: env.SPIKE_RL_MAX ? Number(env.SPIKE_RL_MAX) : undefined,
});

if (env.SPIKE_MIGRATE !== '0') await migrate(pool, auth);

const app = await buildApp({
  pool,
  auth,
  baseURL,
  bridge,
  ajvMode: (env.SPIKE_AJV ?? 'strict') as 'default' | 'strict',
  trustProxyHops: Number(env.SPIKE_TRUST_PROXY_HOPS ?? 0),
  predict: {
    burnMs: Number(env.SPIKE_PREDICT_MS ?? 0),
    mode: (env.SPIKE_PREDICT_MODE ?? 'inline') as 'inline' | 'worker',
    workers: Number(env.SPIKE_WORKERS ?? 2),
  },
  metrics: env.SPIKE_METRICS === '1',
  webDist: env.SPIKE_WEB_DIST ? resolve(env.SPIKE_WEB_DIST) : undefined,
  logger: env.SPIKE_LOG === '1',
});

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  // Stop accepting connections, let in-flight requests finish, then release the DB.
  await app.close();
  await pool.end();
  if (embedded) await embedded.stop();
  console.log(JSON.stringify({ event: 'shutdown-complete', signal }));
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ port, host });
console.log(JSON.stringify({ event: 'listening', port, host, baseURL, node: process.version, bridge }));
