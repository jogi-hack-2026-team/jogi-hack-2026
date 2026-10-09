import assert from 'node:assert/strict';
import test from 'node:test';
import type { GoalCreate, GoalPatch } from '../src/contracts/goal.ts';
import { createRequestHash } from '../src/goals/create-request-fingerprint.ts';
import { isGoalId } from '../src/goals/goal-id.ts';
import { sameGoalSettings, type StoredGoalSettings } from '../src/goals/settings-policy.ts';
import { checkTargetDate, GoalFieldsInvalid } from '../src/goals/target-date-policy.ts';
import { checkGoalFields, GoalFieldsInvalid as LegacyGoalFieldsInvalid } from '../src/goals/extras.ts';
import { createRequestHash as legacyHashEntry, isGoalId as legacyIdEntry } from '../src/goals/store.ts';
import { questionContextChanged, questionAnswersChanged } from '../src/questions/update-policy.ts';

const input: GoalCreate = { title: '英語 30分', unit: 'minutes', totalRequired: 6000, sessionAmount: 30, timezone: 'Asia/Tokyo' };
const current: StoredGoalSettings = Object.freeze({ title: input.title, unit: input.unit,
  total_required: input.totalRequired, session_amount: input.sessionAmount, initial_progress: 0,
  timezone: input.timezone, target_date: '2026-10-12' });
const patch = (fields: Omit<GoalPatch, 'expectedGoalSettingsRevision'>): GoalPatch => ({ expectedGoalSettingsRevision: 0, ...fields });

test('作成fingerprint: 抽出前77c71a5の固定値と省略/null/部分回答の境界を保つ', () => {
  // 抽出前の実storeから取得したgolden。新policyを期待値生成へ使わない。
  const omitted = '4e98fd7a19a63cef36ae933cd832ee26618c7a1d303802acd82db4479310a146';
  assert.equal(createRequestHash(input), omitted);
  assert.equal(createRequestHash({ ...input, targetDate: null }), omitted);
  assert.equal(createRequestHash({ ...input, initialProgress: 0, questionPrior: { a: null, b: null } }), omitted);
  assert.equal(createRequestHash({ ...input, targetDate: '2026-10-12' }), '4e53191fa6dfea7fe4baf6d53be5e52e68cfd18419b22e53984af5964b3e6b0b');
  assert.equal(createRequestHash({ ...input, questionPrior: { a: 'UNKNOWN', b: null } }), '4e384d5566389d4db015b5bb9b77dc56ae8e6d1010a304eb32ce8266a3cdafc9');
  const reordered: GoalCreate = { timezone: input.timezone, sessionAmount: 30, totalRequired: 6000, unit: 'minutes', title: input.title };
  assert.equal(createRequestHash(reordered), omitted);
});

test('設定比較: 全設定の同値再送、各1項目の変更、期限日の維持/解除を区別する', () => {
  assert.equal(sameGoalSettings(current, patch({}), current.target_date), true);
  assert.equal(sameGoalSettings(current, patch({ title: current.title, unit: current.unit, totalRequired: 6000,
    sessionAmount: 30, initialProgress: 0, timezone: current.timezone }), current.target_date), true);
  for (const fields of [{ title: '別の名前' }, { unit: 'sessions' as const }, { totalRequired: 6001 },
    { sessionAmount: 31 }, { initialProgress: 1 }, { timezone: 'UTC' }]) {
    assert.equal(sameGoalSettings(current, patch(fields), current.target_date), false, JSON.stringify(fields));
  }
  assert.equal(sameGoalSettings(current, patch({ targetDate: null }), null), false);
  assert.equal(sameGoalSettings(current, patch({ targetDate: '2026-10-13' }), '2026-10-13'), false);
  assert.equal(sameGoalSettings({ ...current, target_date: null }, patch({ targetDate: null }), null), true);
});

test('設定比較: CASと回答版は設定値の同値とは別で、policyは拒否順を引き取らない', () => {
  const answersOnly: GoalPatch = { expectedGoalSettingsRevision: 2_147_483_647,
    expectedAnswerRevision: Number.MAX_SAFE_INTEGER, questionPrior: { a: 'HIGH', b: null } };
  assert.equal(sameGoalSettings(current, answersOnly, current.target_date), true);
});

test('回答context: 単位と1回量の実変更だけがcontextを変える', () => {
  for (const fields of [{}, { unit: 'minutes' as const }, { sessionAmount: 30 }, { title: '別の名前' },
    { targetDate: null }, { questionPrior: { a: 'HIGH' as const, b: null } }]) {
    assert.equal(questionContextChanged(current, patch(fields)), false, JSON.stringify(fields));
  }
  assert.equal(questionContextChanged(current, patch({ unit: 'sessions' })), true);
  assert.equal(questionContextChanged(current, patch({ sessionAmount: 31 })), true);
});

test('回答変更: 同値/UNKNOWN/null/部分回答と空回答のcontext更新を区別する', () => {
  const saved = Object.freeze({ a: 'UNKNOWN' as const, b: null });
  assert.equal(questionAnswersChanged(false, { a: 'UNKNOWN', b: null }, saved), false);
  assert.equal(questionAnswersChanged(false, { a: null, b: null }, saved), true);
  assert.equal(questionAnswersChanged(false, { a: 'UNKNOWN', b: 'MID' }, saved), true);
  assert.equal(questionAnswersChanged(false, { a: null, b: 'UNKNOWN' }, saved), true);
  assert.equal(questionAnswersChanged(false, { a: null, b: null }, { a: null, b: null }), false);
  assert.equal(questionAnswersChanged(true, { a: null, b: null }, { a: null, b: null }), true);
  assert.deepEqual(saved, { a: 'UNKNOWN', b: null });
});

test('Goal id: 従来のUUID文字列境界と大文字許可を維持する', () => {
  for (const id of ['00000000-0000-0000-0000-000000000000', 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF']) assert.equal(isGoalId(id), true);
  for (const id of ['', '00000000-0000-0000-0000-000000000000 ', '00000000-0000-0000-0000-00000000000z']) assert.equal(isGoalId(id), false);
});

test('旧exportは同じ関数・例外classを返し、422のinstanceofとpayloadを維持する', () => {
  assert.equal(legacyHashEntry, createRequestHash);
  assert.equal(legacyIdEntry, isGoalId);
  assert.equal(checkGoalFields, checkTargetDate);
  assert.equal(LegacyGoalFieldsInvalid, GoalFieldsInvalid);
  const fields = checkTargetDate({ today: '2026-10-09', targetDate: '2026-02-30' });
  assert.deepEqual(fields, [{ path: 'body/targetDate', message: 'must be a valid date' }]);
  const error = new LegacyGoalFieldsInvalid(fields);
  assert.ok(error instanceof GoalFieldsInvalid);
  assert.equal(error.name, 'GoalFieldsInvalid');
  assert.equal(error.message, 'Goal fields are invalid.');
  assert.equal(error.fields, fields);
});
