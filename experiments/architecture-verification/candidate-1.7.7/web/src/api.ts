// Supporting Artifact / Not a Source of Truth (Issue #84).
// Thin hand-written fetch layer. Types come from the shared TypeBox contract; the /today
// response is additionally checked at runtime against the same schema.
import { Value } from '@sinclair/typebox/value';
import { Today, type ErrorBody, type Goal, type GoalCreate, type Log, type LogPut } from '../../src/contracts.ts';

export class ApiError extends Error {
  status: number;
  body: ErrorBody | null;
  constructor(status: number, body: ErrorBody | null) {
    super(body?.error.message ?? `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json);
  return json as T;
}

export const api = {
  listGoals: () => call<Goal[]>('GET', '/api/goals'),
  createGoal: (g: GoalCreate) => call<Goal>('POST', '/api/goals', g),
  putLog: (goalId: string, localDate: string, log: LogPut) => call<Log>('PUT', `/api/goals/${goalId}/logs/${localDate}`, log),
  today: async (goalId: string) => {
    const json = await call<unknown>('GET', `/api/goals/${goalId}/today`);
    if (!Value.Check(Today, json)) throw new ApiError(502, { error: { code: 'CONTRACT_MISMATCH', message: 'today response does not match the shared schema' } });
    return json;
  },
};
