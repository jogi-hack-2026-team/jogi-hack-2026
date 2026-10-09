import { createHash } from 'node:crypto';
import type { GoalCreate } from '../contracts/goal.ts';
import { EMPTY_ANSWERS } from '../questions/snapshot.ts';

// 検証済bodyだけを固定順でcanonical化する。作成後の編集値をhashへ逆流させない。
// 期限日省略/nullは従来のcanonical形を保ち、#148の既存成功台帳も同じbodyでreplayできる。
export function createRequestHash(input: GoalCreate): string {
  const answers = input.questionPrior ?? EMPTY_ANSWERS;
  return createHash('sha256').update(JSON.stringify({ title: input.title, unit: input.unit,
    totalRequired: input.totalRequired, sessionAmount: input.sessionAmount,
    initialProgress: input.initialProgress ?? 0, timezone: input.timezone, ...(input.targetDate == null ? {} : { targetDate: input.targetDate }),
    questionPrior: { a: answers.a, b: answers.b } })).digest('hex');
}
