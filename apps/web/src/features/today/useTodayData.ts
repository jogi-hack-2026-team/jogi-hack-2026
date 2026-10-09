import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { GoalR11, Log, TodayR11 } from '@contracts';
import { goalKeys, goalsHttp } from '../../api/goals-http.ts';
import { todayHttp, todayKeys } from '../../api/today-http.ts';
import { shouldRefetchForNewDay } from './day-rollover.ts';
import { fetchPolicy } from './fetch-policy.ts';
import { isSameSnapshot } from './snapshot.ts';

export type TodaySnapshot = { goal: GoalR11; today: TodayR11; logs: Log[] };

/** 食い違いを取り直す回数の上限。超えたら「表示をそろえられませんでした」と再読み込みを出す。 */
const MAX_RESYNC = 3;
/** 日付の切り替わりを確かめる間隔。端末の時計を Goal の timezone で読み、変わっていれば取り直す。 */
const DAY_CHECK_MS = 30_000;

/**
 * Today 画面の取得（Goal・Today・記録の一覧）。
 * - 3つが同じ時点の材料か（snapshot.ts）を確かめ、そろっている組み合わせだけを snapshot として返す。
 *   食い違っている間は、最後にそろっていた snapshot を出したまま取り直す（古い見通しと新しい見出しを混ぜない）
 * - Goal の timezone で日付が変わったら、画面を開いたままでも取り直す（focus・mount・reconnect が起きなくても）。
 *   API の「今日」が進むまでは、確かめるたびに取り直す（取得中は重ねない）
 * - notBefore より前に届いたデータは使わない（ログインしている人が替わった直後の、前の人のキャッシュ。session-cache.ts）
 */
export function useTodayData(goalId: string, notBefore = 0) {
  const goalQuery = useQuery({ queryKey: goalKeys.detail(goalId), queryFn: ({ signal }) => goalsHttp.getGoal(goalId, signal), ...fetchPolicy });
  const todayQuery = useQuery({ queryKey: todayKeys.today(goalId), queryFn: ({ signal }) => todayHttp.getToday(goalId, signal), ...fetchPolicy });
  const logsQuery = useQuery({ queryKey: todayKeys.logs(goalId), queryFn: ({ signal }) => todayHttp.listLogs(goalId, signal), ...fetchPolicy });
  const refresh = () => void Promise.all([goalQuery.refetch(), todayQuery.refetch(), logsQuery.refetch()]);

  const goal = goalQuery.data;
  const today = todayQuery.data;
  const logs = logsQuery.data;
  const fetching = goalQuery.isFetching || todayQuery.isFetching || logsQuery.isFetching;
  // 利用者が替わった後の取得で届いたものだけを材料にする
  const fresh = [goalQuery, todayQuery, logsQuery].every((q) => q.dataUpdatedAt > notBefore);
  // 最後にそろっていた組み合わせ
  const lastGood = useRef<TodaySnapshot | undefined>(undefined);
  // Today の取得失敗時に記録へ使う Goal も、notBefore より後に届いたものだけを採用する（同じ人かの確認中は更新しない、#190）
  const acceptedGoal = useRef<GoalR11 | undefined>(undefined);
  if (goal && goalQuery.dataUpdatedAt > notBefore) acceptedGoal.current = goal;
  // 予測に使った設定（1回の量など）も含めて、応答の値だけで照らし合わせる（snapshot.ts）
  const consistent = goal && today && logs && fresh ? isSameSnapshot(goal, today, logs) : null;
  if (goal && today && logs && consistent) lastGood.current = { goal, today, logs };

  // 食い違いを取り直す。取得中は待ち、そろったら数え直す
  const [resyncs, setResyncs] = useState(0);
  useEffect(() => {
    if (consistent === true && resyncs !== 0) setResyncs(0);
    if (consistent === false && !fetching && resyncs < MAX_RESYNC) {
      setResyncs((n) => n + 1);
      refresh();
    }
    // refresh は毎回作り直されるが、取り直しのきっかけは consistent・fetching・resyncs だけにする
  }, [consistent, fetching, resyncs]);

  // Goal の timezone で日付が変わったら取り直す。API の「今日」が進むまで、取得中でなければ確かめるたびに
  const fetchingRef = useRef(fetching);
  fetchingRef.current = fetching;
  const shown = lastGood.current;
  useEffect(() => {
    if (!shown) return undefined;
    const check = () => {
      if (fetchingRef.current) return;
      if (shouldRefetchForNewDay(shown.goal.timezone, shown.today.today, new Date())) refresh();
    };
    const timer = setInterval(check, DAY_CHECK_MS);
    return () => clearInterval(timer);
    // 表示している Goal の timezone と「今日」が変わったときだけ、確かめ方を作り直す
  }, [shown?.goal.timezone, shown?.today.today]);

  return {
    goalQuery,
    todayQuery,
    logsQuery,
    /** 同じ時点の材料だとそろっている組み合わせ（まだ一度もそろっていなければ undefined）。 */
    snapshot: lastGood.current,
    /** notBefore より後に届いた最新の Goal（Today の取得失敗時の記録に使う）。 */
    goal: acceptedGoal.current,
    /** 取り直しても食い違いが解けなかった。 */
    resyncFailed: consistent === false && !fetching && resyncs >= MAX_RESYNC,
    refresh,
    retryResync: () => {
      setResyncs(0);
      refresh();
    },
  };
}
