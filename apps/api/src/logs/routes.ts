import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { ErrorBody, Log, LogList, LogParams, LogPut, LogsQuery } from '../contracts/index.ts';
import { GoalParams } from '../contracts/goal.ts';
import { isCalendarDate } from '../goals/local-date.ts';
import { errorBody } from '../http/errors.ts';
import { requireUserId } from '../http/guards.ts';
import { listLogs, putLog } from './store.ts';

export type LogRouteDeps = { pool: Pool; now: () => Date };

const GOAL_NOT_FOUND = errorBody('NOT_FOUND', 'Goal not found.');
const invalidDate = (path: string) => errorBody('VALIDATION_ERROR', 'Request does not match the contract.', [{ path, message: 'must be a real calendar date' }]);

// 記録API（R-03・R-04、#77）。`/api/*`共通hookの内側に置き、認証済みのrequest.userIdを前提にする。
export async function registerLogRoutes(app: FastifyInstance, deps: LogRouteDeps): Promise<void> {
  await app.register(async (instance) => {
    requireUserId(instance);
    const api = instance.withTypeProvider<TypeBoxTypeProvider>();

    api.put(
      '/api/goals/:goalId/logs/:localDate',
      { schema: { params: LogParams, body: LogPut, response: { 200: Log, 404: ErrorBody, 422: ErrorBody } } },
      async (request, reply) => {
        const { goalId, localDate } = request.params;
        if (!isCalendarDate(localDate)) return reply.code(422).send(invalidDate('params/localDate'));
        if (request.body.status === 'SKIPPED' && request.body.amount !== undefined) {
          return reply.code(422).send(
            errorBody('VALIDATION_ERROR', 'Request does not match the contract.', [{ path: 'body/amount', message: 'must be omitted when status is SKIPPED' }]),
          );
        }
        const result = await putLog(deps.pool, request.userId, goalId, localDate, request.body, deps.now);
        switch (result.kind) {
          case 'saved':
            return result.log;
          case 'not_found':
            return reply.code(404).send(GOAL_NOT_FOUND);
          case 'out_of_window':
            return reply.code(422).send(
              errorBody('LOG_DATE_OUT_OF_WINDOW', `Only today (${result.today}) and yesterday (${result.yesterday}) in the goal's time zone can be recorded.`, [
                { path: 'params/localDate', message: `must be ${result.yesterday} or ${result.today}` },
              ]),
            );
          case 'before_start':
            return reply.code(422).send(
              errorBody('LOG_DATE_BEFORE_START', `Days before the record start date (${result.recordStartDate}) cannot be recorded.`, [
                { path: 'params/localDate', message: `must not be before ${result.recordStartDate}` },
              ]),
            );
        }
      },
    );

    api.get(
      '/api/goals/:goalId/logs',
      { schema: { params: GoalParams, querystring: LogsQuery, response: { 200: LogList, 404: ErrorBody, 422: ErrorBody } } },
      async (request, reply) => {
        const { from, to } = request.query;
        if (from !== undefined && !isCalendarDate(from)) return reply.code(422).send(invalidDate('querystring/from'));
        if (to !== undefined && !isCalendarDate(to)) return reply.code(422).send(invalidDate('querystring/to'));
        if (from !== undefined && to !== undefined && from > to) {
          return reply.code(422).send(errorBody('VALIDATION_ERROR', 'Request does not match the contract.', [{ path: 'querystring/to', message: 'must not be before from' }]));
        }
        const logs = await listLogs(deps.pool, request.userId, request.params.goalId, { ...(from !== undefined ? { from } : {}), ...(to !== undefined ? { to } : {}) });
        return logs ?? reply.code(404).send(GOAL_NOT_FOUND);
      },
    );
  });
}
