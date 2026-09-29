import pg from "pg";
import type { PoolClient } from "pg";
// Fixed disposable local database. Never read production connection variables.
export const pool = new pg.Pool({
  host: "127.0.0.1",
  port: 55434,
  database: "bakeoff",
  user: "bakeoff",
  max: 12,
});
export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id uuid PRIMARY KEY, token_hash text NOT NULL, seeds jsonb NOT NULL,
      version integer NOT NULL DEFAULT 0, posterior jsonb NOT NULL
    );
    CREATE TABLE IF NOT EXISTS interactions (
      id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES sessions(id),
      sequence integer NOT NULL, track_id text NOT NULL, anchor_id text NOT NULL,
      candidate_type text NOT NULL CHECK (candidate_type IN ('RELEVANT','PROBE')),
      UNIQUE(session_id, sequence)
    );
    CREATE TABLE IF NOT EXISTS traces (
      interaction_id uuid PRIMARY KEY REFERENCES interactions(id), decision jsonb NOT NULL
    );
    CREATE TABLE IF NOT EXISTS feedback (
      interaction_id uuid PRIMARY KEY REFERENCES interactions(id),
      rating text NOT NULL CHECK (rating IN ('LIKE','NEUTRAL','DISLIKE','UNSURE')),
      revision integer NOT NULL CHECK(revision > 0)
    );
  `);
}
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
