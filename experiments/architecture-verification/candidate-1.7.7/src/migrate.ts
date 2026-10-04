// Supporting Artifact / Not a Source of Truth (Issue #84).
// Order: auth tables -> app tables (mirrors the order planned in #74). The app migration
// runner here is a deliberately tiny stand-in; the real tool is decided in #74.
import { getMigrations } from 'better-auth/db/migration';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Pool } from 'pg';
import type { Auth } from './auth.ts';
import { rootDir } from './paths.ts';

export async function migrate(pool: Pool, auth: Auth) {
  const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);
  await runMigrations();

  await pool.query(
    `create table if not exists spike_schema_migrations (name text primary key, applied_at timestamptz not null default now())`,
  );
  const dir = join(rootDir, 'migrations');
  const applied: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const done = await pool.query('select 1 from spike_schema_migrations where name = $1', [file]);
    if (done.rowCount) continue;
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(readFileSync(join(dir, file), 'utf8'));
      await client.query('insert into spike_schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
      applied.push(file);
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  }
  return {
    authTablesCreated: toBeCreated.map((t) => t.table),
    authColumnsAdded: toBeAdded.map((t) => t.table),
    appMigrationsApplied: applied,
  };
}
