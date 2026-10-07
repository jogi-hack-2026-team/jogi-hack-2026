import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { nextEpoch, sessionChanged } from '../src/api/session-cache.ts';
import { localDateIn, shouldRefetchForNewDay } from '../src/features/today/day-rollover.ts';
import { fetchTodayWithStart, isSameSnapshot, isTodayOlderThanSettings, todayStartedAt } from '../src/features/today/snapshot.ts';

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

test('1回の量などが変わったGoalと、それより前に取得したTodayは組み合わせない', () => {
  // 総量100・実績80・今日未記録・1回量10で取得したTodayの後に、量20へ変わったGoalを取得した
  const shown = { ...goal, totalRequired: 100, initialProgress: 80, sessionAmount: 10 };
  const changed = { ...shown, sessionAmount: 20 };
  // 総量・累計は一致するので isSameSnapshot だけでは見分けられない。Today が古ければ取り直す
  assert.equal(isTodayOlderThanSettings(shown, changed, 2000, 1000), true);
  // 変わった後に取得したTodayなら使う
  assert.equal(isTodayOlderThanSettings(shown, changed, 2000, 3000), false);
  // 設定が変わっていなければ、取得の順番は問わない
  assert.equal(isTodayOlderThanSettings(shown, { ...shown, title: '別名' }, 2000, 1000), false);
  // まだ一度もそろっていない（最初の表示）ときは比べる相手がない
  assert.equal(isTodayOlderThanSettings(undefined, changed, 2000, 1000), false);
});

test('設定を変える前に始めたTodayの取得が、新しいGoalより遅れて届いても使わない', async () => {
  // 総量100・実績80・今日未記録・1回量10。量10の Today を表示中に、量20へ変えた
  const shown = { ...goal, totalRequired: 100, initialProgress: 80, sessionAmount: 10, todayStatus: 'UNRECORDED' };
  const changed = { ...shown, sessionAmount: 20 };
  // 時刻1000に Today の取得を始める（量20へ変える前）。応答は Goal（時刻2000に到着）より後の3000に届く
  let release;
  const pending = fetchTodayWithStart(() => new Promise((resolve) => (release = resolve)), () => 1000);
  release({ ...today });
  const lateOld = await pending;
  assert.equal(todayStartedAt(lateOld), 1000);
  // 届いた時刻（3000）は Goal より後でも、始めた時刻で比べるので古い設定の予測として取り直す
  assert.equal(isTodayOlderThanSettings(shown, changed, 2000, todayStartedAt(lateOld)), true);
  // Goal が届いた後に始めた取得なら使う
  const fresh = await fetchTodayWithStart(async () => ({ ...today }), () => 2500);
  assert.equal(isTodayOlderThanSettings(shown, changed, 2000, todayStartedAt(fresh)), false);
  // 覚えていない値は最も古いものとして扱う
  assert.equal(todayStartedAt({ ...today }), 0);
});

test('Todayの取得を始めた時刻は、同じ内容の応答で取り直しても新しい時刻になる', async () => {
  const client = new QueryClient();
  client.mount();
  let now = 1000;
  const observer = new QueryObserver(client, {
    queryKey: ['goals', 'today', 'g'],
    queryFn: () => fetchTodayWithStart(async () => ({ ...today }), () => now),
    structuralSharing: false,
    retry: false,
  });
  const unsubscribe = observer.subscribe(() => {});
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(todayStartedAt(client.getQueryData(['goals', 'today', 'g'])), 1000);
  now = 5000;
  await observer.refetch();
  // 内容が同じでも前の値（時刻1000）に置き換えられないので、取り直しが止まらなくなることはない
  assert.equal(todayStartedAt(client.getQueryData(['goals', 'today', 'g'])), 5000);
  unsubscribe();
  client.clear();
  client.unmount();
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
