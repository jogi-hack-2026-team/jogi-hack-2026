import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { nextEpoch, sessionChanged } from '../src/api/session-cache.ts';
import { localDateIn, shouldRefetchForNewDay } from '../src/features/today/day-rollover.ts';
import { isSameSnapshot } from '../src/features/today/snapshot.ts';

const goal = {
  id: 'g', title: '英単語', unit: 'minutes', totalRequired: 3000, sessionAmount: 20, initialProgress: 600, timezone: 'Asia/Tokyo',
  recordStartDate: '2026-10-04', hasLogs: true, unitLocked: true, goalSettingsRevision: 0, answerRevision: 0, today: '2026-10-07', todayStatus: 'DONE',
};
const logs = [
  { localDate: '2026-10-06', status: 'DONE', amount: 15 },
  { localDate: '2026-10-07', status: 'DONE', amount: 20 },
];
const today = {
  today: '2026-10-07', yesterday: '2026-10-06', todayLog: logs[1], yesterdayMissing: false,
  prediction: { today: '2026-10-07', todayStatus: 'DONE', progress: { done: 635, total: 3000, completed: false } },
  context: { goalSettingsRevision: 0, answerRevision: 0, unitLocked: true, recordStartDate: '2026-10-04', unit: 'minutes', sessionAmount: 20 },
};

test('Goal・Today・記録が同じ時点の材料ならそろっていると判断する', () => {
  assert.equal(isSameSnapshot(goal, today, logs), true);
});

test('回答だけの変更・撤回・同値への再更新も、版の違うGoalとTodayを組み合わせない', () => {
  const nextGoal = { ...goal, answerRevision: 1, questionPrior: { a: 'HIGH', b: 'LOW' } };
  const nextToday = { ...today, context: { ...today.context, answerRevision: 1 } };
  // 設定・日付・実績・記録は同じでも、回答変更後のGoalと遅れて届いた旧Todayを拒否する。
  assert.equal(isSameSnapshot(nextGoal, today, logs), false);
  assert.equal(isSameSnapshot(nextGoal, nextToday, logs), true);
  assert.equal(isSameSnapshot(goal, nextToday, logs), false, '逆順の遅着も拒否');
  const withdrawn = { ...nextGoal, answerRevision: 2, questionPrior: { a: null, b: null } };
  assert.equal(isSameSnapshot(withdrawn, nextToday, logs), false);
  const answeredAgain = { ...nextGoal, answerRevision: 3 };
  assert.equal(isSameSnapshot(answeredAgain, nextToday, logs), false, '回答値が同じでも版が戻らない');
  const { answerRevision: _removed, ...oldContext } = today.context;
  assert.equal(isSameSnapshot(goal, { ...today, context: oldContext }, logs), false, '欠落した版を0へ補完しない');
});

test('取得した時点がずれた組み合わせを見分ける', () => {
  // 別のタブで総量を変えた後のGoal（Todayは古い総量のまま）
  assert.equal(isSameSnapshot({ ...goal, totalRequired: 200 }, today, logs), false);
  // 記録の一覧だけが古い（昨日の量が違う）
  assert.equal(isSameSnapshot(goal, today, [{ ...logs[0], amount: 10 }, logs[1]]), false);
  // 記録の一覧に今日の記録がまだない（Goal・Today は今日を記録済みのまま、一覧だけが古い）
  assert.equal(isSameSnapshot(goal, { ...today, prediction: { ...today.prediction, progress: { ...today.prediction.progress, done: 615 } } }, [logs[0]]), false);
  // 日付が変わった後のGoalと前日のToday
  assert.equal(isSameSnapshot({ ...goal, today: '2026-10-08' }, today, logs), false);
  // 記録開始日より前の行は実績に数えない
  assert.equal(isSameSnapshot(goal, today, [{ localDate: '2026-10-01', status: 'DONE', amount: 99 }, ...logs]), true);
});

test('昨日の記録の有無が、Todayと記録の一覧で食い違えば組み合わせない', () => {
  // 一覧には昨日の行があるのに、Todayは昨日を未記録としている（昨日を補完した後の一覧と、その前のToday）
  assert.equal(isSameSnapshot(goal, { ...today, yesterdayMissing: true }, logs), false);
  // 一覧に昨日の行がないのに、Todayは記録済みとしている
  const noYesterday = [logs[1]];
  const doneWithoutYesterday = { ...today, prediction: { ...today.prediction, progress: { ...today.prediction.progress, done: 620 } } };
  assert.equal(isSameSnapshot(goal, doneWithoutYesterday, noYesterday), false);
  assert.equal(isSameSnapshot(goal, { ...doneWithoutYesterday, yesterdayMissing: true }, noYesterday), true);
  // 昨日が記録開始日より前なら、行がなくても「未記録」ではない
  const startToday = { ...goal, recordStartDate: '2026-10-07' };
  const startTodayResp = { ...today, yesterdayMissing: false, context: { ...today.context, recordStartDate: '2026-10-07' }, prediction: { ...today.prediction, progress: { ...today.prediction.progress, done: 620 } } };
  assert.equal(isSameSnapshot(startToday, startTodayResp, noYesterday), true);
  assert.equal(isSameSnapshot(startToday, { ...startTodayResp, yesterdayMissing: true }, noYesterday), false);
});

test('画面の1回の量と違う量で計算した予測は、取得の順番や画面の作り直しにかかわらず使わない', () => {
  // 総量100・実績80・今日未記録。1回量10で計算した予測と、量20へ変えた後の予測
  const base = { ...goal, totalRequired: 100, initialProgress: 80, todayStatus: 'UNRECORDED', recordStartDate: '2026-10-07' };
  const goal10 = { ...base, sessionAmount: 10 };
  const goal20 = { ...base, sessionAmount: 20 };
  const resp = (sessionAmount) => ({
    ...today,
    todayLog: null,
    yesterdayMissing: false,
    context: { goalSettingsRevision: 0, answerRevision: 0, unitLocked: true, recordStartDate: '2026-10-07', unit: 'minutes', sessionAmount },
    prediction: { ...today.prediction, todayStatus: 'UNRECORDED', progress: { done: 80, total: 100, completed: false } },
  });
  const today10 = resp(10);
  const today20 = resp(20);
  // 総量・累計・今日の記録はどれも一致する。違いは予測に使った1回の量だけ
  assert.equal(isSameSnapshot(goal10, today10, []), true);
  assert.equal(isSameSnapshot(goal20, today20, []), true);
  // 初回の表示・編集から戻って画面を作り直したとき（前にそろった表示がない）：新しいGoalと古いToday
  assert.equal(isSameSnapshot(goal20, today10, []), false);
  // 古いTodayの応答が、新しいGoal・新しいTodayより後に遅れて届いた
  assert.equal(isSameSnapshot(goal20, today20, []), true);
  assert.equal(isSameSnapshot(goal20, today10, []), false);
  // 逆順：Goalだけが古い（新しいToday・古いGoal）
  assert.equal(isSameSnapshot(goal10, today20, []), false);
  // 単位・記録開始日だけが違う場合も同じ
  assert.equal(isSameSnapshot({ ...goal10, unit: 'sessions' }, today10, []), false);
  assert.equal(isSameSnapshot(goal10, { ...today10, context: { ...today10.context, recordStartDate: '2026-10-06' } }, []), false);
});

test('Goalのtimezoneで日付を数え、APIの「今日」が進むまで取り直しを止めない', () => {
  // 2026-10-07 15:30 UTC は 東京では 10/8 0:30、ロサンゼルスでは 10/7 8:30
  const at = new Date('2026-10-07T15:30:00Z');
  assert.equal(localDateIn('Asia/Tokyo', at), '2026-10-08');
  assert.equal(localDateIn('America/Los_Angeles', at), '2026-10-07');
  assert.equal(localDateIn('Not/AZone', at), null);
  assert.equal(shouldRefetchForNewDay('Asia/Tokyo', '2026-10-07', at), '2026-10-08');
  assert.equal(shouldRefetchForNewDay('America/Los_Angeles', '2026-10-07', at), null);
  // サーバー23:59:50・端末00:00:20：取り直してもAPIはまだ10/7を返す。次に確かめたときも取り直す
  const device = new Date('2026-10-07T15:00:20Z'); // 東京 10/8 0:00:20
  assert.equal(shouldRefetchForNewDay('Asia/Tokyo', '2026-10-07', device), '2026-10-08');
  const later = new Date(device.getTime() + 30_000);
  assert.equal(shouldRefetchForNewDay('Asia/Tokyo', '2026-10-07', later), '2026-10-08');
  // APIの「今日」が10/8へ進めば止まる。端末の時計が遅れていても取り直さない
  assert.equal(shouldRefetchForNewDay('Asia/Tokyo', '2026-10-08', later), null);
  assert.equal(shouldRefetchForNewDay('Asia/Tokyo', '2026-10-09', later), null);
});

test('ログインしている人が変わったときだけ、私的なキャッシュを消す', () => {
  assert.equal(sessionChanged(undefined, 'A'), false); // 最初に分かったとき
  assert.equal(sessionChanged('A', undefined), false); // 読み込み中
  assert.equal(sessionChanged('A', 'A'), false);
  assert.equal(sessionChanged('A', null), true); // ログアウト
  assert.equal(sessionChanged(null, 'B'), true); // 別の人でのログイン
  assert.equal(sessionChanged('A', 'B'), true);
});

test('利用者が替わったら、前の人の取得が止まるまでどのデータも使わず、その後に届いたものだけを使う', () => {
  const start = { owner: undefined, clearedAt: 0 };
  // 最初に分かったときは、すでにあるデータをそのまま使ってよい
  const a = nextEpoch(start, 'A');
  assert.deepEqual(a, { owner: 'A', clearedAt: 0 });
  assert.equal(nextEpoch(a, undefined), a); // 読み込み中は変えない
  assert.equal(nextEpoch(a, 'A'), a);
  // 別の人へ：画面の作り直し（owner が変わる）と、中断が終わるまでの使用停止
  const b = nextEpoch(a, 'B');
  assert.deepEqual(b, { owner: 'B', clearedAt: Number.POSITIVE_INFINITY });
  assert.deepEqual(nextEpoch(a, null), { owner: null, clearedAt: Number.POSITIVE_INFINITY });
});

test('利用者が変わったときの中断と初期化で、取得中の要求が止まり、前の人のデータが消える', async () => {
  const client = new QueryClient();
  client.mount();
  // 前の人のGoal（取得済み）
  client.setQueryData(['goals', 'detail', 'a'], { title: '前の人のGoal' });
  // 前の人として始めた取得（まだ返っていない）
  let aborted = false;
  const observer = new QueryObserver(client, {
    queryKey: ['goals', 'today', 'a'],
    queryFn: ({ signal }) =>
      new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
          aborted = true;
          reject(new DOMException('aborted', 'AbortError'));
        });
      }),
    retry: false,
  });
  const unsubscribe = observer.subscribe(() => {});
  await new Promise((r) => setTimeout(r, 10));

  // session-cache.ts の PrivateCacheGuard と同じ手順（初期化は表示中の取得をやり直すので、その完了は待たない）
  await client.cancelQueries({ queryKey: ['goals'] });
  assert.equal(aborted, true);
  unsubscribe();
  void client.resetQueries({ queryKey: ['goals'] });
  assert.equal(client.getQueryData(['goals', 'detail', 'a']), undefined);
  assert.equal(client.getQueryData(['goals', 'today', 'a']), undefined);
  client.clear();
  client.unmount();
});
