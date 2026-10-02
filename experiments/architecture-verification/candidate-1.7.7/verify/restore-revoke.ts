// Local verification-only operation. No auth HTTP endpoint; no automatic restore.
import { createAuthPool } from '../src/pool.ts';
import { revokeRestoredSessions } from '../src/revoke-restored-sessions.ts';
const url = process.env.DATABASE_URL;
if (process.env.SPIKE_RESTORE_CONFIRM !== 'isolated-restored-db' || !url ||
    !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
  console.error('Refused: explicit isolated loopback restoration confirmation required.');
  process.exitCode = 1;
} else {
  const pool = createAuthPool({ connectionString: url, max: 1 });
  try { console.log(JSON.stringify({ event: 'restored-sessions-revoked', deleted: await revokeRestoredSessions(pool) })); }
  finally { await pool.end(); }
}
