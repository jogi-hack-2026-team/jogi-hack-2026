import { LogList, TodayR11 as TodaySchema } from '@contracts';
import type { Log, TodayR11 } from '@contracts';
import { requestJson } from './http.ts';

/**
 * Today API と記録の一覧（#77）を実際に呼ぶ。Today Decision 画面（#81）が使う。
 * 取得のキーは Goal と同じ ['goals', …] の下に置き、Goal の作成・編集・削除で取り直す対象に含める。
 * Today は R-11 の読み取り（?view=r11）なので、読み取りの表現をキーに含める。
 */
const base = (goalId: string) => `/api/goals/${encodeURIComponent(goalId)}`;

export const todayHttp = {
  /**
   * R-11 の読み取り（?view=r11）。予測に使った設定（context）、回答由来か実記録由来か（provenance）、
   * 材料が足りないときの計画（plan）を含む。専用の schema（TodayR11）で応答を確かめる。
   */
  getToday: (goalId: string, signal?: AbortSignal): Promise<TodayR11> => requestJson(TodaySchema, `${base(goalId)}/today?view=r11`, { signal }),
  /** 全期間の記録（累計の図に使う）。 */
  listLogs: (goalId: string, signal?: AbortSignal): Promise<Log[]> => requestJson(LogList, `${base(goalId)}/logs`, { signal }),
};

export const todayKeys = {
  today: (goalId: string) => ['goals', 'today', goalId, 'r11'] as const,
  logs: (goalId: string) => ['goals', 'logs', goalId] as const,
};
