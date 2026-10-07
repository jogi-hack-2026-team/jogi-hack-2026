import { LogList, Today as TodaySchema } from '@contracts';
import type { Log, Today } from '@contracts';
import { requestJson } from './http.ts';

/**
 * Today API と記録の一覧（#77）を実際に呼ぶ。Today Decision 画面（#81）が使う。
 * 取得のキーは Goal と同じ ['goals', …] の下に置き、Goal の作成・編集・削除で取り直す対象に含める。
 */
const base = (goalId: string) => `/api/goals/${encodeURIComponent(goalId)}`;

export const todayHttp = {
  getToday: (goalId: string, signal?: AbortSignal): Promise<Today> => requestJson(TodaySchema, `${base(goalId)}/today`, { signal }),
  /** 全期間の記録（累計の図に使う）。 */
  listLogs: (goalId: string, signal?: AbortSignal): Promise<Log[]> => requestJson(LogList, `${base(goalId)}/logs`, { signal }),
};

export const todayKeys = {
  today: (goalId: string) => ['goals', 'today', goalId] as const,
  logs: (goalId: string) => ['goals', 'logs', goalId] as const,
};
