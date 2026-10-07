import type { Pool } from 'pg';
import type { Log } from '../contracts/log.ts';
import { isGoalId } from '../goals/store.ts';
import type { QuestionRow } from '../questions/snapshot.ts';

// Todayの材料。Goalと全記録を1つの読み取りsnapshot（repeatable read）で取り、途中で挟まる記録の更新と混ざらないようにする。
export type TodaySnapshot = {
  goal: { totalRequired: number; initialProgress: number; sessionAmount: number; timezone: string; recordStartDate: string; unit: 'minutes' | 'sessions' };
  question: QuestionRow;
  logs: Log[];
  now: Date;
};

export async function loadTodaySnapshot(pool: Pool, userId: string, goalId: string, clock: () => Date): Promise<TodaySnapshot | null> {
  if (!isGoalId(goalId)) return null;
  const client = await pool.connect();
  try {
    await client.query('begin isolation level repeatable read read only');
    const goal = (
      await client.query<QuestionRow & { total_required: number; initial_progress: number; session_amount: number; timezone: string; record_start_date: string; unit: 'minutes' | 'sessions' }>(
        'select total_required, initial_progress, session_amount, timezone, record_start_date::text as record_start_date, unit, question_prior, answer_revision::text as answer_revision, question_prior_snapshot from goal where id = $1 and user_id = $2',
        [goalId, userId],
      )
    ).rows[0];
    if (!goal) {
      await client.query('commit');
      return null;
    }
    // BEGIN alone does not establish the snapshot. Sample after the first SELECT.
    const now = clock();
    const logs = await client.query<{ local_date: string; status: Log['status']; amount: number | null }>(
      'select local_date::text as local_date, status, amount from action_log where goal_id = $1 order by local_date',
      [goalId],
    );
    await client.query('commit');
    return {
      now,
      goal: {
        totalRequired: goal.total_required,
        initialProgress: goal.initial_progress,
        sessionAmount: goal.session_amount,
        timezone: goal.timezone,
        recordStartDate: goal.record_start_date,
        unit: goal.unit,
      },
      question: { question_prior: goal.question_prior, answer_revision: goal.answer_revision, question_prior_snapshot: goal.question_prior_snapshot },
      logs: logs.rows.map((r) => ({ localDate: r.local_date, status: r.status, amount: r.amount })),
    };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
