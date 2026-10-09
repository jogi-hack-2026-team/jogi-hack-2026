// 既存callerの互換入口。実装責務は到達予定日のpolicyへ明示する。
export { checkTargetDate as checkGoalFields, isCalendarDate, GoalFieldsInvalid, type GoalFieldError } from './target-date-policy.ts';
