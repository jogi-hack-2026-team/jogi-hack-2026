import type { QuestionPriorAnswers } from '@futureroi/prediction';
import type { GoalPatch } from '../contracts/goal.ts';
import { sameAnswers } from './snapshot.ts';

/** 単位・1回量の変更は回答contextを変える。title等の設定変更とは別に判定する。 */
export function questionContextChanged(current: { unit: 'minutes' | 'sessions'; session_amount: number }, patch: Pick<GoalPatch, 'unit' | 'sessionAmount'>): boolean {
  return (patch.unit !== undefined && patch.unit !== current.unit) ||
    (patch.sessionAmount !== undefined && patch.sessionAmount !== current.session_amount);
}

/** context変更時は空回答になっても回答版を進める。同値の回答再送は版・snapshotを維持する。 */
export function questionAnswersChanged(contextChanged: boolean, answers: QuestionPriorAnswers, saved: QuestionPriorAnswers): boolean {
  return contextChanged || !sameAnswers(answers, saved);
}
