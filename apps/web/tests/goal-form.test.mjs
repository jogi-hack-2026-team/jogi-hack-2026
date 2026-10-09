import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MutationObserver, QueryClient, QueryObserver } from '@tanstack/react-query';
import { ApiError } from '../src/api/client.ts';
import { goalsCopy } from '../src/copy/goals.ts';
import { answersLockReason, changesAnswerContext, emptyValues, fieldErrorsFromApi, parseInteger, rebaseValues, reloadLatestGoal, switchRecordUnit, toCreateBody, toPatchBody, validate, valuesFromGoal } from '../src/features/goals/goal-form.ts';

const e = goalsCopy.errors;
// 時間のGoalは、総量・記録開始前の量を時間、1回の量を記録の単位（ここでは分）で入力する（#157、C案）
const valid = { title: '英単語アプリ', unit: 'minutes', recordUnit: 'minutes', totalRequired: '50', sessionAmount: '20', initialProgress: '0', timezone: 'Asia/Tokyo', targetDate: '', questionPrior: { a: null, b: null } };
const goal = {
  id: 'g1', title: '英単語アプリ', unit: 'minutes', totalRequired: 3000, sessionAmount: 20, initialProgress: 400, timezone: 'Asia/Tokyo',
  recordStartDate: '2026-08-17', hasLogs: false, today: '2026-10-07', todayStatus: 'UNRECORDED', targetDate: null, recordUnit: 'minutes',
};

test('数の入力は全角数字と桁区切りを受け付け、整数でなければ拒否する', () => {
  assert.equal(parseInteger('３,０００'), 3000);
  assert.equal(parseInteger(' 20 '), 20);
  for (const raw of ['', '1.5', '-1', '1e3', '二十']) assert.equal(parseInteger(raw), null, raw);
});

test('API契約と同じ範囲を、送る前に項目ごとに検査する', () => {
  assert.deepEqual(validate(valid), {});
  const errors = validate({ ...valid, title: '   ', totalRequired: '0', sessionAmount: '', initialProgress: '-1', timezone: 'Mars/Base' });
  // 時間で入力する欄（総量・記録開始前の量）は小数第1位までの数、分で入力する1回の量は整数
  assert.deepEqual(errors, { title: e.titleRequired, totalRequired: e.positiveHours, sessionAmount: e.positiveInteger, initialProgress: e.nonNegativeHours, timezone: e.timezone });
  // タイトルは100文字まで（絵文字も1文字と数える）
  assert.deepEqual(validate({ ...valid, title: '😀'.repeat(100) }), {});
  assert.equal(validate({ ...valid, title: 'あ'.repeat(101) }).title, e.titleTooLong);
  // DBの整数の上限を超える数
  assert.equal(validate({ ...valid, totalRequired: '35791395' }).totalRequired, e.tooLarge);
  assert.equal(validate({ ...valid, initialProgress: '0' }).initialProgress, undefined);
});

test('記録があるGoalでは、変更できない2項目を検査も送信もしない', () => {
  const locked = { ...valid, initialProgress: 'x', timezone: '' };
  assert.deepEqual(validate(locked, { locked: true }), {});
  const patch = toPatchBody({ ...valuesFromGoal(goal), title: '新しい名前', initialProgress: '999', timezone: 'UTC' }, { ...goal, hasLogs: true });
  assert.deepEqual(patch, { title: '新しい名前' });
});

test('作成は全項目を整数で送り、編集は変えた項目だけを送る（変更がなければ送らない）', () => {
  // 時間の入力は分へ換算して送る（全角数字も受け付ける）
  assert.deepEqual(toCreateBody({ ...valid, totalRequired: '５０' }), { title: '英単語アプリ', unit: 'minutes', totalRequired: 3000, sessionAmount: 20, initialProgress: 0, timezone: 'Asia/Tokyo', recordUnit: 'minutes', questionPrior: { a: null, b: null } });
  assert.equal(toPatchBody(valuesFromGoal(goal), goal), null);
  // 時間から回へ変えると、入力欄の数は回として読む。保存値と同じ数（3000・400）は送らず、変えた項目だけを送る
  assert.deepEqual(toPatchBody({ ...valuesFromGoal(goal), unit: 'sessions', totalRequired: '3000', sessionAmount: '25', initialProgress: '400', timezone: 'UTC' }, goal), { unit: 'sessions', sessionAmount: 25, timezone: 'UTC' });
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
  assert.deepEqual(toPatchBody({ ...base, totalRequired: '66.7' }, answered), { totalRequired: 4002 });
});

test('回答の版の誤り（422）は回答の欄のエラーとして出す', () => {
  const error = new ApiError(422, { error: { code: 'VALIDATION_ERROR', message: 'x', fields: [{ path: 'body/expectedAnswerRevision', message: 'x' }] } });
  assert.deepEqual(fieldErrorsFromApi(error), { questionPrior: e.server });
});

test('409の後に最新を読み直したら、触っていない項目は最新の値にし、別の画面での変更を巻き戻さない（R-11、#137）', () => {
  const previous = { ...goal, questionPrior: { a: 'MID', b: null }, answerRevision: 3 };
  // 別の画面で、タイトル・総量・回答が変わった
  const latest = { ...previous, title: '英単語アプリ（夜）', totalRequired: 5000, questionPrior: { a: 'LOW', b: 'LOW' }, answerRevision: 4 };
  // 回答だけを編集していた
  const edited = { ...valuesFromGoal(previous), questionPrior: { a: 'HIGH', b: 'HIGH' } };
  const rebased = rebaseValues(edited, previous, latest);
  assert.equal(rebased.title, '英単語アプリ（夜）');
  // 時間のGoalの総量は時間で入力欄に戻す（5000分→83.3時間）
  assert.equal(rebased.totalRequired, '83.3');
  assert.deepEqual(rebased.questionPrior, { a: 'HIGH', b: 'HIGH' });
  // 再保存では、編集した回答と最新の版だけを送り、タイトル・総量を古い値で送らない
  assert.deepEqual(toPatchBody(rebased, latest), { questionPrior: { a: 'HIGH', b: 'HIGH' }, expectedAnswerRevision: 4 });
  // 触った項目（タイトル）は入力を残し、触っていない回答は最新にする
  const titleEdited = rebaseValues({ ...valuesFromGoal(previous), title: '自分の名前' }, previous, latest);
  assert.equal(titleEdited.title, '自分の名前');
  assert.deepEqual(titleEdited.questionPrior, { a: 'LOW', b: 'LOW' });
  assert.deepEqual(toPatchBody(titleEdited, latest), { title: '自分の名前' });
});

test('単位か1回の量を変えている間は、保存済みの回答がなくても回答の欄を押せなくする（R-11、#137）', () => {
  const unanswered = { ...goal, questionPrior: { a: null, b: null }, answerRevision: 0 };
  const answered = { ...goal, questionPrior: { a: 'MID', b: null }, answerRevision: 3 };
  const changed = { ...valuesFromGoal(unanswered), sessionAmount: '30', questionPrior: { a: 'HIGH', b: 'LOW' } };
  assert.equal(answersLockReason(changed, unanswered), 'notSaved');
  // 回答の欄が押せない理由と送信内容が一致する（回答は送らない）
  assert.deepEqual(toPatchBody(changed, unanswered), { sessionAmount: 30, expectedAnswerRevision: 0 });
  assert.equal(answersLockReason({ ...valuesFromGoal(answered), unit: 'sessions' }, answered), 'withdrawn');
  assert.equal(answersLockReason({ ...valuesFromGoal(unanswered), totalRequired: '66.7' }, unanswered), null);
});

test('409後の再取得は通信中断・503の古いcacheを採用せず、成功した最新の版でだけ再保存できる', async () => {
  for (const failure of [new TypeError('Failed to fetch'), new ApiError(503, null)]) {
    const client = new QueryClient();
    const previous = { ...goal, questionPrior: { a: 'MID', b: 'LOW' }, answerRevision: 0 };
    const latest = { ...previous, title: '別の画面のタイトル', questionPrior: { a: 'LOW', b: 'LOW' }, answerRevision: 1 };
    const edited = { ...valuesFromGoal(previous), questionPrior: { a: 'HIGH', b: 'HIGH' } };
    let failed = true;
    const observer = new QueryObserver(client, {
      queryKey: ['goal', failure.name], initialData: previous, retry: false,
      queryFn: async () => { if (failed) throw failure; return latest; },
    });
    try {
      assert.equal(await reloadLatestGoal(() => observer.refetch()), undefined);
      // 固定版React Queryは失敗結果にも古いdataを保持するが、比較元に採用しない。
      assert.equal(observer.getCurrentResult().data, previous);
      assert.equal(observer.getCurrentResult().isError, true);
      assert.deepEqual(edited.questionPrior, { a: 'HIGH', b: 'HIGH' });
      failed = false;
      const loaded = await reloadLatestGoal(() => observer.refetch());
      assert.deepEqual(loaded, latest);
      assert.deepEqual(toPatchBody(rebaseValues(edited, previous, loaded), loaded), {
        questionPrior: { a: 'HIGH', b: 'HIGH' }, expectedAnswerRevision: 1,
      });
    } finally { client.clear(); }
  }
});

test('最新取得のPromiseがrejectしても成功扱いせず、未取得なら比較元を返さない', async () => {
  assert.equal(await reloadLatestGoal(async () => { throw new Error('aborted'); }), undefined);
  assert.equal(await reloadLatestGoal(async () => ({ isSuccess: true, data: undefined })), undefined);
});

test('時間のGoal：総量・記録開始前の量は時間、1回の量は記録の単位で入力し、分へ換算して送る（#157、C案）', () => {
  const hours = { ...valid, recordUnit: 'hours', totalRequired: '50', sessionAmount: '1.5', initialProgress: '0.5' };
  assert.deepEqual(validate(hours), {});
  const body = toCreateBody(hours);
  assert.deepEqual([body.totalRequired, body.sessionAmount, body.initialProgress, body.recordUnit], [3000, 90, 30, 'hours']);
  // 小数は第1位まで。0時間の1回の量は受け付けない
  assert.equal(validate({ ...hours, sessionAmount: '1.25' }).sessionAmount, e.positiveHours);
  assert.equal(validate({ ...hours, sessionAmount: '0' }).sessionAmount, e.positiveHours);
  // 回のGoalには記録の単位を送らない
  assert.equal('recordUnit' in toCreateBody({ ...valid, unit: 'sessions', totalRequired: '100' }), false);
  // 保存値を時間で出した欄は、触らなければ送らない（400分→6.7時間→402分にしない）
  const hourGoal = { ...goal, recordUnit: 'hours', sessionAmount: 50 };
  const shown = valuesFromGoal(hourGoal);
  assert.deepEqual([shown.totalRequired, shown.sessionAmount, shown.initialProgress], ['50', '0.8', '6.7']);
  assert.equal(toPatchBody(shown, hourGoal), null);
  // 記録の単位だけを変えたら、記録の単位だけを送る（量は分で保存しているので変わらない）
  const switched = switchRecordUnit(valuesFromGoal(goal), 'hours');
  assert.equal(switched.sessionAmount, '0.3'); // 20分→0.3時間
  assert.deepEqual(toPatchBody(switched, goal), { recordUnit: 'hours' });
});

test('到達予定日：任意で、今日より後だけ。空にすると未設定（null）で送る（#157、B案）', () => {
  assert.deepEqual(validate({ ...valid, targetDate: '2026-10-08' }, { today: '2026-10-07' }), {});
  assert.equal(validate({ ...valid, targetDate: '2026-10-07' }, { today: '2026-10-07' }).targetDate, e.targetDatePast);
  assert.equal(toCreateBody({ ...valid, targetDate: '2027-03-31' }).targetDate, '2027-03-31');
  assert.equal('targetDate' in toCreateBody(valid), false);
  const withTarget = { ...goal, targetDate: '2027-03-31', hasLogs: true };
  assert.equal(toPatchBody(valuesFromGoal(withTarget), withTarget), null);
  // 記録があっても変えられる。空にすると null
  assert.deepEqual(toPatchBody({ ...valuesFromGoal(withTarget), targetDate: '2027-06-30' }, withTarget), { targetDate: '2027-06-30' });
  assert.deepEqual(toPatchBody({ ...valuesFromGoal(withTarget), targetDate: '' }, withTarget), { targetDate: null });
});
