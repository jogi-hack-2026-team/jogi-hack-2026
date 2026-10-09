import type { Goal, GoalPatch } from '../contracts/goal.ts';

// ロック内で読んだ設定値だけを比較する。CAS・期限日の検査・ログ有無の判定はstoreの順序を保つ。
export type StoredGoalSettings = {
  title: string;
  unit: Goal['unit'];
  total_required: number;
  session_amount: number;
  initial_progress: number;
  timezone: string;
  target_date: string | null;
};
type SettingsPatch = Pick<GoalPatch, 'title' | 'unit' | 'totalRequired' | 'sessionAmount' | 'initialProgress' | 'timezone'>;

/** 省略項目を維持し、storeで解決済みの期限日を含めた同値再送かを判定する。 */
export function sameGoalSettings(current: StoredGoalSettings, patch: SettingsPatch, nextTargetDate: string | null): boolean {
  return (patch.title === undefined || patch.title === current.title) &&
    (patch.unit === undefined || patch.unit === current.unit) &&
    (patch.totalRequired === undefined || patch.totalRequired === current.total_required) &&
    (patch.sessionAmount === undefined || patch.sessionAmount === current.session_amount) &&
    (patch.initialProgress === undefined || patch.initialProgress === current.initial_progress) &&
    (patch.timezone === undefined || patch.timezone === current.timezone) && nextTargetDate === current.target_date;
}
