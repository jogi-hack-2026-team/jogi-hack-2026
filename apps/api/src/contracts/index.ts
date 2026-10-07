// APIとWebで共有する契約（TypeBox）。APIは実行時検証と応答の直列化、Webは型と実行時確認に使う。
// Webからは vite / tsconfig の alias `@contracts` でこのファイルを参照する。
// Web bundleにも入るため、ここからpg・server専用処理・環境変数をimportしない。
export { ErrorBody } from './error.ts';
export { Goal, GoalCreate, GoalList, GoalParams, GoalPatch, GoalUnit, LocalDate, TodayStatus } from './goal.ts';
export { Health } from './health.ts';
export { Log, LogList, LogParams, LogPut, LogStatus, LogsQuery, PredictionResultSchema, Today } from './log.ts';
