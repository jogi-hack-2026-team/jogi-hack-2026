// Supporting Artifact. Run OFFLINE, after restoring and before opening traffic.
// Stops old session cookies; does not fix resurrected users/passwords/accounts.
import type { Pool } from 'pg';

export async function revokeRestoredSessions(pool: Pool): Promise<number> {
  const deleted = await pool.query('delete from session');
  return deleted.rowCount ?? 0;
}
