import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureSave, rebaseSave } from '../src/features/logs/useSaveLog.ts';
import { loadCreateAttempt, prepareCreateAttempt, clearCreateAttempt } from '../src/features/goals/create-attempt.ts';
import { toLogPut } from '../src/features/logs/record-log.ts';
const context = { id: 'g1', unit: 'minutes', timezone: 'Asia/Tokyo', goalSettingsRevision: 0 };
const body = { title: '合成Goal', unit: 'minutes', totalRequired: 100, sessionAmount: 10, timezone: 'Asia/Tokyo' };
const key = '00000000-0000-4000-8000-000000000148';
const storage = () => { const rows = new Map(); return { getItem: k => rows.get(k) ?? null, setItem: (k,v) => rows.set(k,v), removeItem: k => rows.delete(k) }; };
test('F02/F04: 保存操作はGoal・日・量・版を固定し、明示rebaseは版だけを替える', () => {
  const choice = { status: 'DONE', amount: 10 };
  const vars = captureSave(context, '2026-10-09', choice);
  choice.amount = 100;
  assert.deepEqual(vars, { goalId: 'g1', localDate: '2026-10-09', choice: { status: 'DONE', amount: 10 }, expectedGoalSettingsRevision: 0, unit: 'minutes', timezone: 'Asia/Tokyo' });
  const rebased = rebaseSave(vars, { ...context, goalSettingsRevision: 2 });
  assert.deepEqual(rebased, { ...vars, expectedGoalSettingsRevision: 2 });
  assert.deepEqual(toLogPut(rebased.choice, rebased.expectedGoalSettingsRevision), { status: 'DONE', amount: 10, expectedGoalSettingsRevision: 2 });
});
test('F05: Goal/単位/timezone変更は同数値を自動rebaseしない', () => {
  const vars = captureSave(context, '2026-10-09', { status: 'DONE', amount: 10 });
  for (const changed of [{ id: 'g2' }, { unit: 'sessions' }, { timezone: 'UTC' }]) assert.equal(rebaseSave(vars, { ...context, ...changed }), null);
});
test('F06/F07/F08: 未確定createは同ownerのキー・原bodyを復元し、別ownerに持ち越さない', () => {
  const db = storage();
  const a = prepareCreateAttempt('a', body, db, () => key);
  body.title = '入力変更';
  assert.equal(a.body.title, '合成Goal');
  assert.deepEqual(prepareCreateAttempt('a', body, db, () => { throw Error('新keyは禁止'); }), a);
  assert.deepEqual(loadCreateAttempt('a', db), a);
  assert.equal(loadCreateAttempt('b', db), null);
  clearCreateAttempt('a', db);
  assert.equal(loadCreateAttempt('a', db), null);
  assert.equal(prepareCreateAttempt('a', body, db, () => key).body.title, '入力変更');
});
test('回復情報の破損・保存失敗は新keyで送信を進めない', () => {
  assert.throws(() => prepareCreateAttempt('a', body, { getItem: () => '{', setItem() {}, removeItem() {} }, () => key));
  assert.throws(() => prepareCreateAttempt('a', body, { getItem: () => null, setItem() { throw Error('容量'); }, removeItem() {} }, () => key), /容量/);
});
