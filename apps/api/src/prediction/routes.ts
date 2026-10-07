import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { GoalParams } from '../contracts/goal.ts';
import { ErrorBody, Today, TodayR11, R11ViewQuery } from '../contracts/index.ts';
import { localDateIn, shiftLocalDate } from '../goals/local-date.ts';
import { errorBody } from '../http/errors.ts';
import { requireUserId } from '../http/guards.ts';
import { runPrediction } from './engine.ts';
import { loadTodaySnapshot } from './store.ts';
import { buildR11Today } from './r11.ts';

export type TodayRouteDeps = { pool: Pool; now: () => Date };

const GOAL_NOT_FOUND = errorBody('NOT_FOUND', 'Goal not found.');

// GET /api/goals/:goalId/today（R-05〜R-08、#77）。
// 最初のGoal SELECTでsnapshotを確定後に時計を1回だけ読み、Goalと記録を同じsnapshotで取得し、DB接続を返してから純粋Engineを呼ぶ（Architecture「実装時に必要な対策」）。
export async function registerTodayRoute(app: FastifyInstance, deps: TodayRouteDeps): Promise<void> {
  await app.register(async (instance) => {
    requireUserId(instance);
    const api = instance.withTypeProvider<TypeBoxTypeProvider>();

    api.get('/api/goals/:goalId/today', { schema: { params: GoalParams, querystring: R11ViewQuery,
      response: { 200: Type.Union([TodayR11, Today]), 404: ErrorBody, 422: ErrorBody } } }, async (request, reply) => {
      const snapshot = await loadTodaySnapshot(deps.pool, request.userId, request.params.goalId, deps.now);
      if (!snapshot) return reply.code(404).send(GOAL_NOT_FOUND);
      // DB接続はloadTodaySnapshotのfinallyで返却済み。選んだ表現のEngineだけを1回呼ぶ。
      if (request.query.view === 'r11') return buildR11Today(snapshot);
      const today = localDateIn(snapshot.now, snapshot.goal.timezone);
      const yesterday = shiftLocalDate(today, -1);
      const todayLog = snapshot.logs.find((l) => l.localDate === today) ?? null;
      // 昨日の問いかけは、昨日が記録開始日以降のときだけ（P-14。開始日前は補完対象ではない）。
      const yesterdayMissing = yesterday >= snapshot.goal.recordStartDate && !snapshot.logs.some((l) => l.localDate === yesterday);
      const prediction = runPrediction({
        goal: { totalRequired: snapshot.goal.totalRequired, initialProgress: snapshot.goal.initialProgress, sessionAmount: snapshot.goal.sessionAmount },
        logs: snapshot.logs,
        today,
      });
      return { today, yesterday, todayLog, yesterdayMissing, prediction };
    });
  });
}
