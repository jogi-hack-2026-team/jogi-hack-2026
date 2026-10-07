import { Goal as GoalSchema, GoalList } from '@contracts';
import type { Goal, GoalCreate, GoalPatch } from '@contracts';
import { requestJson, requestNoContent } from './http.ts';

/**
 * Goal API（#76）を実際に呼ぶ。Goal の一覧・作成・編集・削除の画面（#78）と、Today 画面（#81）の Goal の取得が使う。
 */
const path = (goalId: string) => `/api/goals/${encodeURIComponent(goalId)}`;

export const goalsHttp = {
  listGoals: (): Promise<Goal[]> => requestJson(GoalList, '/api/goals'),
  getGoal: (goalId: string): Promise<Goal> => requestJson(GoalSchema, path(goalId)),
  createGoal: (body: GoalCreate): Promise<Goal> => requestJson(GoalSchema, '/api/goals', { method: 'POST', body }),
  updateGoal: (goalId: string, body: GoalPatch): Promise<Goal> => requestJson(GoalSchema, path(goalId), { method: 'PATCH', body }),
  deleteGoal: (goalId: string): Promise<void> => requestNoContent(path(goalId), { method: 'DELETE' }),
};

/** Goal の取得結果をまとめて持つキー。作成・編集・削除の後に、一覧と個別の両方を取り直す。 */
export const goalKeys = {
  all: ['goals'] as const,
  list: () => ['goals', 'list'] as const,
  detail: (goalId: string) => ['goals', 'detail', goalId] as const,
};
