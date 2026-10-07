import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { Goal, Log, Today } from '@contracts';
import { goalKeys, goalsHttp } from '../../api/goals-http.ts';
import { todayHttp, todayKeys } from '../../api/today-http.ts';
import { shouldRefetchForNewDay } from './day-rollover.ts';
import { fetchPolicy } from './fetch-policy.ts';
import { isSameSnapshot } from './snapshot.ts';

export type TodaySnapshot = { goal: Goal; today: Today; logs: Log[] };

/** 食い違いを取り直す回数の上限。超えたら「表示をそろえられませんでした」と再読み込みを出す。 */
const MAX_RESYNC = 3;
/** 日付の切り替わりを確かめる間隔。通信はせず、端末の時計を Goal の timezone で読むだけ。 */
const DAY_CHECK_MS = 30_000;

/**
 * Today 画面の取得（Goal・Today・記録の一覧）。
 * - 3つが同じ時点の材料か（snapshot.ts）を確かめ、そろっている組み合わせだけを snapshot として返す。
 *   食い違っている間は、最後にそろっていた snapshot を出したまま取り直す（古い見通しと新しい見出しを混ぜない）
 * - Goal の timezone で日付が変わったら、画面を開いたままでも取り直す（focus・mount・reconnect が起きなくても）
 */
export function useTodayData(goalId: string) {
  const goalQuery = useQuery({ queryKey: goalKeys.detail(goalId), queryFn: ({ signal }) => goalsHttp.getGoal(goalId, signal), ...fetchPolicy });
  const todayQuery = useQuery({ queryKey: todayKeys.today(goalId), queryFn: ({ signal }) => todayHttp.getToday(goalId, signal), ...fetchPolicy });
  const logsQuery = useQuery({ queryKey: todayKeys.logs(goalId), queryFn: ({ signal }) => todayHttp.listLogs(goalId, signal), ...fetchPolicy });
  const refresh = () => void Promise.all([goalQuery.refetch(), todayQuery.refetch(), logsQuery.refetch()]);

  const goal = goalQuery.data;
  const today = todayQuery.data;
  const logs = logsQuery.data;
  const fetching = goalQuery.isFetching || todayQuery.isFetching || logsQuery.isFetching;
  const consistent = goal && today && logs ? isSameSnapshot(goal, today, logs) : null;

  // 最後にそろっていた組み合わせ
  const lastGood = useRef<TodaySnapshot | undefined>(undefined);
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

  // Goal の timezone で日付が変わったら取り直す（変わった日付ごとに1回）
  const triggeredFor = useRef<string | null>(null);
  const shown = lastGood.current;
  useEffect(() => {
    if (!shown) return undefined;
    const check = () => {
      const next = shouldRefetchForNewDay(shown.goal.timezone, shown.today.today, new Date(), triggeredFor.current);
      if (next) {
        triggeredFor.current = next;
        refresh();
      }
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
    /** 取り直しても食い違いが解けなかった。 */
    resyncFailed: consistent === false && !fetching && resyncs >= MAX_RESYNC,
    refresh,
    retryResync: () => {
      setResyncs(0);
      refresh();
    },
  };
}
