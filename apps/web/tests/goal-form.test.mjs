import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../src/api/client.ts';
import { goalsCopy } from '../src/copy/goals.ts';
import { emptyValues, fieldErrorsFromApi, parseInteger, toCreateBody, toPatchBody, validate, valuesFromGoal } from '../src/features/goals/goal-form.ts';

const e = goalsCopy.errors;
const valid = { title: '英単語アプリ', unit: 'minutes', totalRequired: '3000', sessionAmount: '20', initialProgress: '0', timezone: 'Asia/Tokyo' };
const goal = {
  id: 'g1', title: '英単語アプリ', unit: 'minutes', totalRequired: 3000, sessionAmount: 20, initialProgress: 400, timezone: 'Asia/Tokyo',
  recordStartDate: '2026-08-17', hasLogs: false, today: '2026-10-07', todayStatus: 'UNRECORDED',
};

test('数の入力は全角数字と桁区切りを受け付け、整数でなければ拒否する', () => {
  assert.equal(parseInteger('３,０００'), 3000);
  assert.equal(parseInteger(' 20 '), 20);
  for (const raw of ['', '1.5', '-1', '1e3', '二十']) assert.equal(parseInteger(raw), null, raw);
});

test('API契約と同じ範囲を、送る前に項目ごとに検査する', () => {
  assert.deepEqual(validate(valid), {});
  const errors = validate({ ...valid, title: '   ', totalRequired: '0', sessionAmount: '', initialProgress: '-1', timezone: 'Mars/Base' });
  assert.deepEqual(errors, { title: e.titleRequired, totalRequired: e.positiveInteger, sessionAmount: e.positiveInteger, initialProgress: e.nonNegativeInteger, timezone: e.timezone });
  // タイトルは100文字まで（絵文字も1文字と数える）
  assert.deepEqual(validate({ ...valid, title: '😀'.repeat(100) }), {});
  assert.equal(validate({ ...valid, title: 'あ'.repeat(101) }).title, e.titleTooLong);
  // DBの整数の上限を超える数
  assert.equal(validate({ ...valid, totalRequired: '2147483648' }).totalRequired, e.tooLarge);
  assert.equal(validate({ ...valid, initialProgress: '0' }).initialProgress, undefined);
});

test('記録があるGoalでは、変更できない2項目を検査も送信もしない', () => {
  const locked = { ...valid, initialProgress: 'x', timezone: '' };
  assert.deepEqual(validate(locked, { locked: true }), {});
  const patch = toPatchBody({ ...valuesFromGoal(goal), title: '新しい名前', initialProgress: '999', timezone: 'UTC' }, { ...goal, hasLogs: true });
  assert.deepEqual(patch, { title: '新しい名前' });
});

test('作成は全項目を整数で送り、編集は変えた項目だけを送る（変更がなければ送らない）', () => {
  assert.deepEqual(toCreateBody({ ...valid, totalRequired: '３,０００' }), { title: '英単語アプリ', unit: 'minutes', totalRequired: 3000, sessionAmount: 20, initialProgress: 0, timezone: 'Asia/Tokyo' });
  assert.equal(toPatchBody(valuesFromGoal(goal), goal), null);
  assert.deepEqual(toPatchBody({ ...valuesFromGoal(goal), unit: 'sessions', sessionAmount: '25', timezone: 'UTC' }, goal), { unit: 'sessions', sessionAmount: 25, timezone: 'UTC' });
  assert.equal(emptyValues('Asia/Tokyo').initialProgress, '0');
});

test('APIの422を項目ごとのエラーへ割り当てる', () => {
  const validation = new ApiError(422, { error: { code: 'VALIDATION_ERROR', message: 'x', fields: [{ path: 'body/totalRequired', message: 'must be >= 1' }, { path: 'body/timezone', message: 'bad' }, { path: 'body/unknown', message: 'x' }] } });
  assert.deepEqual(fieldErrorsFromApi(validation), { totalRequired: e.positiveInteger, timezone: e.timezone });
  const locked = new ApiError(422, { error: { code: 'GOAL_HAS_LOGS', message: 'x', fields: [{ path: 'body/timezone', message: 'x' }, { path: 'body/initialProgress', message: 'x' }] } });
  assert.deepEqual(fieldErrorsFromApi(locked), { timezone: e.locked, initialProgress: e.locked });
  // 項目のない422は空（画面は保存失敗として出す）、422以外と通信の失敗はnull
  assert.deepEqual(fieldErrorsFromApi(new ApiError(422, { error: { code: 'CONSTRAINT_VIOLATION', message: 'x' } })), {});
  assert.equal(fieldErrorsFromApi(new ApiError(500, null)), null);
  assert.equal(fieldErrorsFromApi(new TypeError('Failed to fetch')), null);
});
