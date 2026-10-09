import type { TodayR11 } from '../contracts/r11.ts';
import { localDateIn, shiftLocalDate } from '../goals/local-date.ts';
import { validateSavedQuestion } from '../questions/snapshot.ts';
import { runQuestionPrediction } from './engine.ts';
import type { TodaySnapshot } from './store.ts';

// 呼出元はsnapshot取得とDB接続返却を完了してから呼ぶ。回答は保存mappingで全実ログへ接続する。
export function buildR11Today(snapshot: TodaySnapshot): TodayR11 {
  const context = { unit: snapshot.goal.unit, sessionAmount: snapshot.goal.sessionAmount, recordStartDate: snapshot.goal.recordStartDate, goalSettingsRevision: snapshot.goal.goalSettingsRevision, unitLocked: snapshot.goal.unitLocked };
  const saved = validateSavedQuestion(snapshot.question, context);
  const today = localDateIn(snapshot.now, snapshot.goal.timezone);
  const yesterday = shiftLocalDate(today, -1);
  const { prediction, provenance, plan } = runQuestionPrediction({
    prediction: { goal: { totalRequired: snapshot.goal.totalRequired, initialProgress: snapshot.goal.initialProgress, sessionAmount: snapshot.goal.sessionAmount }, logs: snapshot.logs, today },
    answers: saved.answers, mapping: saved.mapping,
  });
  return { schemaVersion: 'r11-v1', today, yesterday,
    todayLog: snapshot.logs.find(log => log.localDate === today) ?? null,
    yesterdayMissing: yesterday >= context.recordStartDate && !snapshot.logs.some(log => log.localDate === yesterday),
    prediction, context, provenance, plan };
}
