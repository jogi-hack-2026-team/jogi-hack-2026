// 画面が呼ぶ Goal・記録・Today の入口。いまは仮API（./mock）につないでいる。
// #70 の基盤と #76・#77 の実APIが揃ったら、この中身だけを実際の取得（./client.ts）に差し替え、画面側は変えない。
import * as mock from './mock/handlers.ts';

export const goalsApi = {
  listGoals: mock.listGoals,
  getGoal: mock.getGoal,
  listLogs: mock.listLogs,
  getToday: mock.getToday,
} as const;

/** いま仮APIを使っているか（画面に「仮のデータ」と出すため）。 */
export const usingMockApi = true;
