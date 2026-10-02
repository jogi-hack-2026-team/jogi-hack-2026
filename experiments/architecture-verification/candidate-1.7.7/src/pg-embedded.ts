// Supporting Artifact / Not a Source of Truth (Issue #84).
// Starts a real PostgreSQL server from the embedded-postgres binaries. Used only because
// Docker is not available on the verification machine. Credentials are generated per data
// directory and stored under .local/ (gitignored).
import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { localDir, rootDir } from './paths.ts';

export { localDir, rootDir };

export type PgHandle = { connectionString: string; stop: () => Promise<void> };

export async function startPg(opts: { name?: string; port?: number; fresh?: boolean } = {}): Promise<PgHandle> {
  const name = opts.name ?? 'main';
  const port = opts.port ?? 55484;
  const dataDir = join(localDir, `pg-${name}`);
  const credFile = join(localDir, `pg-${name}.json`);
  if (opts.fresh) {
    rmSync(dataDir, { recursive: true, force: true });
    rmSync(credFile, { force: true });
  }
  mkdirSync(localDir, { recursive: true });
  const isNew = !existsSync(join(dataDir, 'PG_VERSION'));
  let cred: { user: string; password: string; database: string };
  if (isNew) {
    cred = { user: 'spike', password: randomBytes(18).toString('base64url'), database: 'future_roi_spike' };
    writeFileSync(credFile, JSON.stringify(cred), { mode: 0o600 });
  } else {
    cred = JSON.parse(readFileSync(credFile, 'utf8'));
  }
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: cred.user,
    password: cred.password,
    port,
    persistent: true,
    onLog: () => {},
    onError: () => {},
  });
  if (isNew) await pg.initialise();
  await pg.start();
  if (isNew) await pg.createDatabase(cred.database);
  return {
    connectionString: `postgres://${cred.user}:${encodeURIComponent(cred.password)}@127.0.0.1:${port}/${cred.database}`,
    stop: () => pg.stop(),
  };
}
