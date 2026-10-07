import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { sessionChanged } from '../src/api/session-cache.ts';
import { localDateIn, shouldRefetchForNewDay } from '../src/features/today/day-rollover.ts';
import { isSameSnapshot } from '../src/features/today/snapshot.ts';

const goal = {
  id: 'g', title: '英単語', unit: 'minutes', totalRequired: 3000, sessionAmount: 20, initialProgress: 600, timezone: 'Asia/Tokyo',
  recordStartDate: '2026-10-04', hasLogs: true, today: '2026-10-07', todayStatus: 'DONE',
};
const logs = [
  { localDate: '2026-10-06', status: 'DONE', amount: 15 },
  { localDate: '2026-10-07', status: 'DONE', amount: 20 },
];
const today = {
  today: '2026-10-07', yesterday: '2026-10-06', todayLog: logs[1], yesterdayMissing: false,
  prediction: { today: '2026-10-07', todayStatus: 'DONE', progress: { done: 635, total: 3000, completed: false } },
};

test('Goal・Today・記録が同じ時点の材料ならそろっていると判断する', () => {
  assert.equal(isSameSnapshot(goal, today, logs), true);
});

test('取得した時点がずれた組み合わせを見分ける', () => {
  // 別のタブで総量を変えた後のGoal（Todayは古い総量のまま）
  assert.equal(isSameSnapshot({ ...goal, totalRequired: 200 }, today, logs), false);
  // 記録の一覧だけが古い（昨日の量が違う）
  assert.equal(isSameSnapshot(goal, today, [{ ...logs[0], amount: 10 }, logs[1]]), false);
  // 記録の一覧に今日の記録がまだない
  assert.equal(isSameSnapshot({ ...goal, todayStatus: 'UNRECORDED' }, today, [logs[0]]), false);
  // 日付が変わった後のGoalと前日のToday
  assert.equal(isSameSnapshot({ ...goal, today: '2026-10-08' }, today, logs), false);
  // 記録開始日より前の行は実績に数えない
  assert.equal(isSameSnapshot(goal, today, [{ localDate: '2026-10-01', status: 'DONE', amount: 99 }, ...logs]), true);
});

test('Goalのtimezoneで日付を数え、変わった日付ごとに1回だけ取り直す', () => {
  // 2026-10-07 15:30 UTC は 東京では 10/8 0:30、ロサンゼルスでは 10/7 8:30
  const at = new Date('2026-10-07T15:30:00Z');
  assert.equal(localDateIn('Asia/Tokyo', at), '2026-10-08');
  assert.equal(localDateIn('America/Los_Angeles', at), '2026-10-07');
  assert.equal(localDateIn('Not/AZone', at), null);
  assert.equal(shouldRefetchForNewDay('Asia/Tokyo', '2026-10-07', at, null), '2026-10-08');
  assert.equal(shouldRefetchForNewDay('Asia/Tokyo', '2026-10-07', at, '2026-10-08'), null);
  assert.equal(shouldRefetchForNewDay('America/Los_Angeles', '2026-10-07', at, null), null);
});

test('ログインしている人が変わったときだけ、私的なキャッシュを消す', () => {
  assert.equal(sessionChanged(undefined, 'A'), false); // 最初に分かったとき
  assert.equal(sessionChanged('A', undefined), false); // 読み込み中
  assert.equal(sessionChanged('A', 'A'), false);
  assert.equal(sessionChanged('A', null), true); // ログアウト
  assert.equal(sessionChanged(null, 'B'), true); // 別の人でのログイン
  assert.equal(sessionChanged('A', 'B'), true);
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
