// 仮API。#125・#127 の契約（@contracts）と同じ形・同じ status・同じエラーコードで応答する。
// 応答は返す前に契約で実行時にも確かめ、仮APIが契約からずれたらすぐ分かるようにする。
import { Value } from '@sinclair/typebox/value';
import { GoalList, Goal, LogList, Today, type ErrorBody, type Log } from '@contracts';
import type { TSchema, Static } from '@sinclair/typebox';
import { ApiError } from '../client.ts';
import { findScenario, scenarios, type ScenarioFailure } from './scenarios.ts';

/** 読み込み中の表示を確かめられるよう、少し待ってから応答する。 */
const DELAY_MS = 350;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(failure: ScenarioFailure): never {
  if (failure.kind === 'network') throw new TypeError('Failed to fetch');
  const body: ErrorBody = { error: { code: failure.code, message: failure.message } };
  throw new ApiError(failure.status, body);
}

function notFound(): never {
  fail({ kind: 'http', status: 404, code: 'NOT_FOUND', message: 'Goal not found.' });
}

function checked<T extends TSchema>(schema: T, value: unknown, what: string): Static<T> {
  if (!Value.Check(schema, value)) {
    const first = [...Value.Errors(schema, value)][0];
    throw new Error(`仮APIの${what}が契約と一致しません: ${first?.path ?? ''} ${first?.message ?? ''}`);
  }
  return value;
}

export async function listGoals(): Promise<Goal[]> {
  await wait(DELAY_MS);
  return checked(GoalList, scenarios.filter((s) => !s.goalFailure).map((s) => s.goal), 'Goal一覧');
}

export async function getGoal(goalId: string): Promise<Goal> {
  await wait(DELAY_MS);
  const s = findScenario(goalId);
  if (!s) notFound();
  if (s.goalFailure) fail(s.goalFailure);
  return checked(Goal, s.goal, 'Goal');
}

export async function listLogs(goalId: string): Promise<Log[]> {
  await wait(DELAY_MS);
  const s = findScenario(goalId);
  if (!s || s.goalFailure) notFound();
  return checked(LogList, s.logs, '記録一覧');
}

export async function getToday(goalId: string): Promise<Today> {
  await wait(DELAY_MS);
  const s = findScenario(goalId);
  if (!s) notFound();
  if (s.todayFailure) fail(s.todayFailure);
  return checked(Today, s.today, 'Today');
}
