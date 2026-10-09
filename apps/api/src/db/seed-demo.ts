import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { isValidTimeZone } from '../goals/local-date.ts';
import { createDemoSeedData, type DemoSlot } from './demo-data.ts';

export type DemoSeedErrorCode = 'INVALID_INPUT' | 'AUTH_USER_NOT_FOUND' | 'OWNERSHIP_INVALID' | 'ROLLBACK_FAILED' | 'COMMIT_OUTCOME_UNKNOWN';
export class DemoSeedError extends Error {
  readonly code: DemoSeedErrorCode;
  constructor(code: DemoSeedErrorCode) { super(`demo-seed: ${code}`); this.code = code; }
}
export type DemoSeedResult = {
  seedVersion: 1; baseDate: string; timezone: string; replacedGoalCount: number;
  goals: { slot: DemoSlot; id: string }[]; goalCount: 2; logCount: 60;
};
type Marker = { slot: DemoSlot; goal_id: string; seed_version: number };
const TITLE: Record<DemoSlot, string> = { 'fast-resumption': 'デモ：すぐ再開する', 'slow-resumption': 'デモ：再開に時間がかかる' };

/** operatorが指定した認証済みdemoユーザーへ、専用2Goalだけを作成／resetする。認証情報は書き換えない。 */
export async function seedDemo(pool: Pool, o: { userId: string; timezone: string; now?: () => Date }): Promise<DemoSeedResult> {
  if (!o.userId || o.userId !== o.userId.trim() || !isValidTimeZone(o.timezone)) throw new DemoSeedError('INVALID_INPUT');
  const client = await pool.connect();
  let discard: Error | undefined;
  let commitSent = false;
  try {
    await client.query('begin isolation level read committed');
    await client.query("set local lock_timeout = '30s'");
    await client.query("set local statement_timeout = '35s'");
    // 初回はmarker行がないので、userId単位のtransaction lockで並行seedも直列化する。
    // hash衝突は余分な待機に留まる。所有権の判定はtextのuserIdと複合FKで行う。
    await client.query('select pg_advisory_xact_lock(820013, hashtext($1))', [o.userId]);
    const user = await client.query(`select u.id from "user" u where u.id = $1
      and exists (select 1 from account a where a."userId" = u.id and a."providerId" = 'credential' and a.password is not null)
      for key share of u`, [o.userId]);
    if (user.rowCount !== 1) throw new DemoSeedError('AUTH_USER_NOT_FOUND');

    // 通常Goal DELETEのCASCADEと逆順にlockしない。Goalを先にID順でlockし、その後のstatementでmarker全件を再取得する。
    const locked = await client.query<{ id: string }>(`select g.id from goal g join demo_seed_goal d
      on d.goal_id = g.id and d.user_id = g.user_id where d.user_id = $1 order by g.id for update of g`, [o.userId]);
    const markers = (await client.query<Marker>('select slot, goal_id, seed_version from demo_seed_goal where user_id = $1 order by slot for update', [o.userId])).rows;
    const oldIds = new Set(locked.rows.map(row => row.id));
    if (markers.length > 2 || markers.some(row => row.seed_version !== 1 || !Object.hasOwn(TITLE, row.slot) || !oldIds.has(row.goal_id))) {
      throw new DemoSeedError('OWNERSHIP_INVALID');
    }
    // lock待ちの日またぎを含めて基準時刻を一度だけ取得し、日付・作成時刻を揃える。
    const instant = (o.now ?? (() => new Date()))();
    let data: ReturnType<typeof createDemoSeedData>;
    try { data = createDemoSeedData(instant, o.timezone); } catch (error) {
      if (error instanceof RangeError) throw new DemoSeedError('INVALID_INPUT');
      throw error;
    }
    const idsToDelete = markers.map(row => row.goal_id);
    const deleted = await client.query('delete from goal where user_id = $1 and id = any($2::uuid[]) returning id', [o.userId, idsToDelete]);
    if (deleted.rowCount !== idsToDelete.length) throw new DemoSeedError('OWNERSHIP_INVALID');
    const goals: DemoSeedResult['goals'] = [];
    for (const row of data) {
      let id = randomUUID();
      while (oldIds.has(id)) id = randomUUID();
      await client.query(`insert into goal (id, user_id, title, unit, total_required, initial_progress, session_amount, timezone, record_start_date, created_at, updated_at, unit_history_locked)
        values ($1, $2, $3, 'sessions', 60, 0, 1, $4, $5, $6, $6, true)`, [id, o.userId, TITLE[row.slot], row.timezone, row.recordStartDate, instant]);
      await client.query('insert into demo_seed_goal (user_id, slot, goal_id, seed_version) values ($1, $2, $3, 1)', [o.userId, row.slot, id]);
      for (const log of row.input.logs) {
        await client.query('insert into action_log (goal_id, local_date, status, amount) values ($1, $2, $3, $4)', [id, log.localDate, log.status, log.amount]);
      }
      goals.push({ slot: row.slot, id });
    }
    commitSent = true;
    await client.query('commit');
    return { seedVersion: 1, baseDate: data[0]!.input.today, timezone: o.timezone, replacedGoalCount: idsToDelete.length, goals, goalCount: 2, logCount: 60 };
  } catch (error) {
    try { await client.query('rollback'); } catch (rollbackError) {
      discard = rollbackError instanceof Error ? rollbackError : new Error('demo-seed rollback failed');
      throw new DemoSeedError(commitSent ? 'COMMIT_OUTCOME_UNKNOWN' : 'ROLLBACK_FAILED');
    }
    // COMMIT送信後の通信失敗は、serverが確定した可能性を否定できない。失敗として報告し、再実行で専用状態へ収束させる。
    if (commitSent) { discard = error instanceof Error ? error : new Error('demo-seed commit failed'); throw new DemoSeedError('COMMIT_OUTCOME_UNKNOWN'); }
    throw error;
  } finally { client.release(discard); }
}
