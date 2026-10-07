import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { ApiError } from '../src/api/client.ts';
import { goalsCopy } from '../src/copy/goals.ts';
import { changesAnswerContext, emptyValues, fieldErrorsFromApi, parseInteger, toCreateBody, toPatchBody, validate, valuesFromGoal } from '../src/features/goals/goal-form.ts';

const e = goalsCopy.errors;
const valid = { title: '英単語アプリ', unit: 'minutes', totalRequired: '3000', sessionAmount: '20', initialProgress: '0', timezone: 'Asia/Tokyo', questionPrior: { a: null, b: null } };
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
  assert.deepEqual(toCreateBody({ ...valid, totalRequired: '３,０００' }), { title: '英単語アプリ', unit: 'minutes', totalRequired: 3000, sessionAmount: 20, initialProgress: 0, timezone: 'Asia/Tokyo', questionPrior: { a: null, b: null } });
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

test('編集を始めた時点の値と比べ、別のタブでの変更を触っていない項目で巻き戻さない', () => {
  // 編集開始時：sessionAmount=20。その後、別のタブで30へ変更され、再取得でGoalが新しくなった
  const baseline = goal;
  const refreshed = { ...goal, sessionAmount: 30 };
  const values = { ...valuesFromGoal(baseline), title: '英単語アプリ（朝）' };
  // 比較元を編集開始時に固定していれば、タイトルだけを送る
  assert.deepEqual(toPatchBody(values, baseline), { title: '英単語アプリ（朝）' });
  // 比較元を再取得後のGoalにすると、触っていない sessionAmount=20 まで送って巻き戻してしまう（直す前の動き）
  assert.deepEqual(toPatchBody(values, refreshed), { title: '英単語アプリ（朝）', sessionAmount: 20 });
});

test('保存の途中で画面を離れたら、mutateに渡した一覧への移動は呼ばれず、取り直しだけは行われる', async () => {
  const client = new QueryClient();
  let finish;
  let invalidated = 0;
  let navigated = 0;
  const observer = new MutationObserver(client, {
    mutationFn: () => new Promise((resolve) => (finish = resolve)),
    onSuccess: () => {
      invalidated += 1;
    },
  });
  const unsubscribe = observer.subscribe(() => {});
  const pending = observer.mutate(undefined, { onSuccess: () => (navigated += 1) }).catch(() => {});
  // 保存の要求が送られるのを待つ
  while (!finish) await new Promise((r) => setTimeout(r, 1));
  // 保存の途中でフォームを離れる（部品が消えると購読も外れる）
  unsubscribe();
  finish({ ok: true });
  await pending;
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(invalidated, 1);
  assert.equal(navigated, 0);
  client.clear();
});
test('R-11の回答は、変えたときだけ両方の問いと版を送り、単位・1回の量を変えるときは版だけを送る', () => {
  const answered = { ...goal, questionPrior: { a: 'MID', b: null }, answerRevision: 3 };
  const base = valuesFromGoal(answered);
  assert.deepEqual(base.questionPrior, { a: 'MID', b: null });
  // 回答に触れない無関係な更新には版を付けない（付けると422）
  assert.deepEqual(toPatchBody({ ...base, title: '新しい名前' }, answered), { title: '新しい名前' });
  // 片方だけ変えても、もう片方を含めて両方送る
  assert.deepEqual(toPatchBody({ ...base, questionPrior: { a: 'MID', b: 'UNKNOWN' } }, answered), {
    questionPrior: { a: 'MID', b: 'UNKNOWN' }, expectedAnswerRevision: 3,
  });
  // 撤回は両方null
  assert.deepEqual(toPatchBody({ ...base, questionPrior: { a: null, b: null } }, answered), {
    questionPrior: { a: null, b: null }, expectedAnswerRevision: 3,
  });
  // 1回の量を変えるときは回答を送らず（APIが取り消す）、版だけを送る
  assert.deepEqual(toPatchBody({ ...base, sessionAmount: '30', questionPrior: { a: 'HIGH', b: 'HIGH' } }, answered), {
    sessionAmount: 30, expectedAnswerRevision: 3,
  });
  assert.equal(changesAnswerContext({ ...base, unit: 'sessions' }, answered), true);
  assert.equal(changesAnswerContext({ ...base, totalRequired: '9999' }, answered), false);
  // 総量だけの変更は回答を保ち、版も送らない
  assert.deepEqual(toPatchBody({ ...base, totalRequired: '4000' }, answered), { totalRequired: 4000 });
});

test('回答の版の誤り（422）は回答の欄のエラーとして出す', () => {
  const error = new ApiError(422, { error: { code: 'VALIDATION_ERROR', message: 'x', fields: [{ path: 'body/expectedAnswerRevision', message: 'x' }] } });
  assert.deepEqual(fieldErrorsFromApi(error), { questionPrior: e.server });
});