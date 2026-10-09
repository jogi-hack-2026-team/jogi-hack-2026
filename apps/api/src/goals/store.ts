import type { Pool, PoolClient } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import type { Goal, GoalCreate, GoalPatch, TodayStatus } from '../contracts/goal.ts';
import { localDateIn } from './local-date.ts';
import type { QuestionPriorAnswers } from '@futureroi/prediction';
import { EMPTY_ANSWERS, makeQuestionSnapshot, sameAnswers, validateSavedQuestion, type QuestionRow } from '../questions/snapshot.ts';
import { PredictionFailed } from '../prediction/engine.ts';

// GoalのSQL。所有者条件（user_id）を全ての読み書きに付け、他人のGoalは「存在しない」として扱う。
// 日付（date型）はpgがDateへ変換して端末のtimezoneに依存するため、SQL側でtextにして受け取る。

type Queryable = Pick<Pool, 'query'> | PoolClient;

type GoalRow = QuestionRow & {
  id: string;
  title: string;
  unit: Goal['unit'];
  total_required: number;
  session_amount: number;
  initial_progress: number;
  timezone: string;
  record_start_date: string;
  has_logs: boolean;
  unit_history_locked: boolean;
  goal_settings_revision: number;
};

const BASE_GOAL_COLUMNS = `g.id, g.title, g.unit, g.total_required, g.session_amount, g.initial_progress, g.timezone,
  g.unit_history_locked, g.goal_settings_revision, g.record_start_date::text as record_start_date, g.question_prior, g.answer_revision::text as answer_revision, g.question_prior_snapshot`;
const GOAL_COLUMNS = `${BASE_GOAL_COLUMNS},
  exists (select 1 from action_log l where l.goal_id = g.id) as has_logs`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** uuidでない文字列はDBへ渡さず「存在しない」として扱う（型キャストの500を避ける）。 */
export const isGoalId = (value: string): boolean => UUID.test(value);

async function todayStatuses(db: Queryable, pairs: { goalId: string; today: string }[]): Promise<Map<string, TodayStatus>> {
  const statuses = new Map<string, TodayStatus>();
  if (pairs.length === 0) return statuses;
  // Goalごとに「今日」が違う（timezoneが違う）ため、(goal_id, local_date)の組で引く。
  const rows = await db.query<{ goal_id: string; status: 'DONE' | 'SKIPPED' }>(
    `select l.goal_id, l.status from action_log l
       join unnest($1::uuid[], $2::date[]) as t(goal_id, local_date) on l.goal_id = t.goal_id and l.local_date = t.local_date`,
    [pairs.map((p) => p.goalId), pairs.map((p) => p.today)],
  );
  for (const r of rows.rows) statuses.set(r.goal_id, r.status);
  return statuses;
}

/**
 * 記録した累計のうち、日々の記録（DONEの量）の合計。initialProgressを足したものがTodayの予測のprogress.doneと一致する
 * （Engineは渡した記録のDONEをすべて足す。記録APIは記録開始日より前・今日より後の行を作らない）。
 * Todayと同じく、応答時点の今日までに限って数える。
 */
async function doneTotals(db: Queryable, rows: { goalId: string; today: string }[]): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (rows.length === 0) return totals;
  const result = await db.query<{ goal_id: string; done: string }>(
    `select l.goal_id, sum(l.amount)::text as done from action_log l
       join unnest($1::uuid[], $2::date[]) as t(goal_id, today) on l.goal_id = t.goal_id
      where l.status = 'DONE' and l.local_date <= t.today
      group by l.goal_id`,
    [rows.map((r) => r.goalId), rows.map((r) => r.today)],
  );
  for (const r of result.rows) totals.set(r.goal_id, Number(r.done));
  return totals;
}

export type GoalRead = Goal & { questionPrior: QuestionPriorAnswers; answerRevision: number };
async function toGoals(db: Queryable, rows: GoalRow[], now: Date): Promise<GoalRead[]> {
  const todays = rows.map((r) => ({ goalId: r.id, today: localDateIn(now, r.timezone) }));
  const statuses = await todayStatuses(db, todays);
  const done = await doneTotals(db, todays);
  return rows.map((r, i) => {
    const saved = validateSavedQuestion(r, { unit: r.unit, sessionAmount: r.session_amount, recordStartDate: r.record_start_date });
    return {
    id: r.id,
    title: r.title,
    unit: r.unit,
    totalRequired: r.total_required,
    sessionAmount: r.session_amount,
    initialProgress: r.initial_progress,
    timezone: r.timezone,
    recordStartDate: r.record_start_date,
    hasLogs: r.has_logs,
    unitLocked: r.unit_history_locked || r.initial_progress > 0,
    goalSettingsRevision: r.goal_settings_revision,
    today: todays[i]!.today,
    todayStatus: statuses.get(r.id) ?? 'UNRECORDED',
    progressDone: r.initial_progress + (done.get(r.id) ?? 0),
    questionPrior: saved.answers, answerRevision: saved.revision,
    };
  });
}

async function readGoals(pool: Pool, sql: string, values: string[], now: () => Date): Promise<GoalRead[]> {
  const client = await pool.connect();
  try {
    await client.query('begin isolation level repeatable read read only');
    const rows = await client.query<GoalRow>(sql, values); // first SELECT fixes the snapshot
    const goals = await toGoals(client, rows.rows, now());
    await client.query('commit');
    return goals;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function listGoals(pool: Pool, userId: string, now: () => Date): Promise<GoalRead[]> {
  return readGoals(pool, `select ${GOAL_COLUMNS} from goal g where g.user_id = $1 order by g.created_at, g.id`, [userId], now);
}

export async function getGoal(pool: Pool, userId: string, goalId: string, now: () => Date): Promise<GoalRead | null> {
  if (!isGoalId(goalId)) return null;
  return (await readGoals(pool, `select ${GOAL_COLUMNS} from goal g where g.user_id = $1 and g.id = $2`, [userId, goalId], now))[0] ?? null;
}

// 検証済bodyだけを固定順でcanonical化する。作成後の編集値をhashへ逆流させない。
export function createRequestHash(input: GoalCreate): string {
  const answers = input.questionPrior ?? EMPTY_ANSWERS;
  return createHash('sha256').update(JSON.stringify({ title: input.title, unit: input.unit,
    totalRequired: input.totalRequired, sessionAmount: input.sessionAmount,
    initialProgress: input.initialProgress ?? 0, timezone: input.timezone,
    questionPrior: { a: answers.a, b: answers.b } })).digest('hex');
}
export type CreateResult = { kind: 'created' | 'replayed'; goal: GoalRead } | { kind: 'conflict' | 'deleted' };

// unique制約待機後の別SELECTで勝者のcommitを見る。予約・Goal INSERTを同じtransactionで完了する。
export async function createGoalOnce(pool: Pool, userId: string, input: GoalCreate, clock: () => Date, key: string): Promise<CreateResult> {
  const client = await pool.connect();
  try {
    await client.query('begin isolation level read committed');
    const hash = createRequestHash(input);
    const reservation = await client.query(
      'insert into goal_create_operation (user_id, idempotency_key, request_hash) values ($1, $2::uuid, $3) on conflict do nothing returning request_hash',
      [userId, key.toLowerCase(), hash]);
    if (reservation.rowCount === 0) {
      const operation = (await client.query<{ request_hash: string; goal_id: string | null }>(
        'select request_hash, goal_id from goal_create_operation where user_id = $1 and idempotency_key = $2::uuid for update', [userId, key])).rows[0]!;
      if (operation.request_hash !== hash) { await client.query('rollback'); return { kind: 'conflict' }; }
      const rows = operation.goal_id === null ? [] : (await client.query<GoalRow>(
        `select ${GOAL_COLUMNS} from goal g where g.user_id = $1 and g.id = $2`, [userId, operation.goal_id])).rows;
      if (!rows[0]) { await client.query('commit'); return { kind: 'deleted' }; }
      const goal = (await toGoals(client, rows, clock()))[0]!;
      await client.query('commit');
      return { kind: 'replayed', goal };
    }
    const now = clock();
    const recordStartDate = localDateIn(now, input.timezone);
    const answers = input.questionPrior ?? EMPTY_ANSWERS;
    const snapshot = makeQuestionSnapshot(answers, { unit: input.unit, sessionAmount: input.sessionAmount, recordStartDate });
    const rows = await client.query<GoalRow>(
      `with inserted as (
         insert into goal (user_id, title, unit, total_required, session_amount, initial_progress, timezone, record_start_date, created_at, updated_at, question_prior, question_prior_snapshot)
         values ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $9, $10::jsonb, $11::jsonb)
         returning *)
       select ${GOAL_COLUMNS} from inserted g`,
      [userId, input.title, input.unit, input.totalRequired, input.sessionAmount, input.initialProgress ?? 0, input.timezone, recordStartDate, now, JSON.stringify(answers), snapshot === null ? null : JSON.stringify(snapshot)]);
    const goal = (await toGoals(client, rows.rows, now))[0]!;
    await client.query('update goal_create_operation set goal_id = $3 where user_id = $1 and idempotency_key = $2::uuid', [userId, key, goal.id]);
    await client.query('commit');
    return { kind: 'created', goal };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally { client.release(); }
}
// 内部のfixture作成も同じtransaction経路を使う。HTTPでは必須headerからキーを受ける。
export async function createGoal(pool: Pool, userId: string, input: GoalCreate, clock: () => Date): Promise<GoalRead> {
  const result = await createGoalOnce(pool, userId, input, clock, randomUUID());
  if ('goal' in result) return result.goal;
  throw new Error('Fresh create key did not create a goal');
}

export type LockedField = 'timezone' | 'initialProgress';
export type UpdateResult = { kind: 'updated'; goal: GoalRead } | { kind: 'not_found' } | { kind: 'locked'; fields: LockedField[] }
  | { kind: 'settings_conflict' | 'unit_locked' | 'revision_exhausted' } | { kind: 'answer_conflict' } | { kind: 'invalid_question_patch'; field: 'questionPrior' | 'expectedAnswerRevision' };

// 記録が1件でもあるGoalでは timezone と initialProgress を変更できない（R-02）。
// 同じ値の再送は「変更」ではないので通す。行をロックして、同時の記録追加と判定がずれないようにする。
export async function updateGoal(pool: Pool, userId: string, goalId: string, patch: GoalPatch, now: () => Date): Promise<UpdateResult> {
  if (!isGoalId(goalId)) return { kind: 'not_found' };
  const client = await pool.connect();
  try {
    await client.query('begin isolation level read committed');
    const current = (
      await client.query<Omit<GoalRow, 'has_logs'>>(`select ${BASE_GOAL_COLUMNS} from goal g where g.user_id = $1 and g.id = $2 for update of g`, [userId, goalId])
    ).rows[0];
    if (!current) {
      await client.query('rollback');
      return { kind: 'not_found' };
    }
    if (patch.expectedGoalSettingsRevision !== current.goal_settings_revision) {
      await client.query('rollback'); return { kind: 'settings_conflict' };
    }
    if ((current.unit_history_locked || current.initial_progress > 0) && patch.unit !== undefined && patch.unit !== current.unit) {
      await client.query('rollback'); return { kind: 'unit_locked' };
    }
    const saved = validateSavedQuestion(current, { unit: current.unit, sessionAmount: current.session_amount, recordStartDate: current.record_start_date });
    if (patch.questionPrior !== undefined && patch.expectedAnswerRevision === undefined) {
      await client.query('rollback');
      return { kind: 'invalid_question_patch', field: 'expectedAnswerRevision' };
    }
    if (patch.expectedAnswerRevision !== undefined && patch.questionPrior === undefined && patch.unit === undefined && patch.sessionAmount === undefined) {
      await client.query('rollback');
      return { kind: 'invalid_question_patch', field: 'expectedAnswerRevision' };
    }
    // 古い版は同じ内容の再送でも拒否する。title等も含めて全体をrollbackする。
    if (patch.expectedAnswerRevision !== undefined && patch.expectedAnswerRevision !== saved.revision) {
      await client.query('rollback');
      return { kind: 'answer_conflict' };
    }
    const contextChanged = (patch.unit !== undefined && patch.unit !== current.unit) ||
      (patch.sessionAmount !== undefined && patch.sessionAmount !== current.session_amount);
    if (contextChanged && patch.questionPrior !== undefined && (patch.questionPrior.a !== null || patch.questionPrior.b !== null)) {
      await client.query('rollback');
      return { kind: 'invalid_question_patch', field: 'questionPrior' };
    }
    const answers = contextChanged ? EMPTY_ANSWERS : (patch.questionPrior ?? saved.answers);
    const changed = contextChanged || !sameAnswers(answers, saved.answers);
    if (changed && saved.revision === Number.MAX_SAFE_INTEGER) {
      throw new PredictionFailed({ name: 'AnswerRevisionError', reason: 'ANSWER_REVISION_EXHAUSTED', path: ['answerRevision'] });
    }
    const revision = saved.revision + (changed ? 1 : 0);
    // 同じ回答の再送は保存snapshotを保持し、最新mappingへ読み替えない。
    const questionSnapshot = contextChanged ? null : (!sameAnswers(answers, saved.answers)
      ? makeQuestionSnapshot(answers, { unit: current.unit, sessionAmount: current.session_amount, recordStartDate: current.record_start_date })
      : current.question_prior_snapshot);
    // READ COMMITTED takes a fresh snapshot after any Goal lock wait. A first log
    // committed by the shared-lock holder must be visible before checking R-02.
    const hasLogs = (await client.query<{ has_logs: boolean }>('select exists (select 1 from action_log where goal_id = $1) as has_logs', [goalId])).rows[0]!.has_logs;
    if (hasLogs) {
      const locked: LockedField[] = [];
      if (patch.timezone !== undefined && patch.timezone !== current.timezone) locked.push('timezone');
      if (patch.initialProgress !== undefined && patch.initialProgress !== current.initial_progress) locked.push('initialProgress');
      if (locked.length) {
        await client.query('rollback');
        return { kind: 'locked', fields: locked };
      }
    }
    const sameGoal = (patch.title === undefined || patch.title === current.title) &&
      (patch.unit === undefined || patch.unit === current.unit) &&
      (patch.totalRequired === undefined || patch.totalRequired === current.total_required) &&
      (patch.sessionAmount === undefined || patch.sessionAmount === current.session_amount) &&
      (patch.initialProgress === undefined || patch.initialProgress === current.initial_progress) &&
      (patch.timezone === undefined || patch.timezone === current.timezone);
    if (!sameGoal && current.goal_settings_revision === 2_147_483_647) {
      await client.query('rollback'); return { kind: 'revision_exhausted' };
    }
    if (!changed && sameGoal) {
      // 回答版付きの全同値再送はSQL UPDATEも省き、updated_atを含む保存metadataを保持する。
      const goal = (await toGoals(client, [{ ...current, has_logs: hasLogs }], now()))[0]!;
      await client.query('commit');
      return { kind: 'updated', goal };
    }
    const updated = await client.query<GoalRow>(
      `with changed as (
         update goal set
           title = coalesce($3, title),
           unit = coalesce($4, unit),
           total_required = coalesce($5, total_required),
           session_amount = coalesce($6, session_amount),
           initial_progress = coalesce($7, initial_progress),
           timezone = coalesce($8, timezone),
           question_prior = $9::jsonb,
           answer_revision = $10::bigint,
           question_prior_snapshot = $11::jsonb,
           goal_settings_revision = $12
         where user_id = $1 and id = $2
         returning *)
       select ${GOAL_COLUMNS} from changed g`,
      [userId, goalId, patch.title ?? null, patch.unit ?? null, patch.totalRequired ?? null, patch.sessionAmount ?? null, patch.initialProgress ?? null, patch.timezone ?? null,
        JSON.stringify(answers), String(revision), questionSnapshot === null ? null : JSON.stringify(questionSnapshot), current.goal_settings_revision + (sameGoal ? 0 : 1)],
    );
    const goal = (await toGoals(client, [updated.rows[0]!], now()))[0]!;
    await client.query('commit');
    return { kind: 'updated', goal };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** 削除。紐づく記録はDBの外部キー（ON DELETE CASCADE）で消える。 */
export async function deleteGoal(db: Queryable, userId: string, goalId: string): Promise<boolean> {
  if (!isGoalId(goalId)) return false;
  const result = await db.query('delete from goal where user_id = $1 and id = $2', [userId, goalId]);
  return (result.rowCount ?? 0) > 0;
}
