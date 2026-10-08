import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { authClient } from '../auth/client.ts';
import { goalKeys } from './goals-http.ts';

/**
 * ログインしている人の識別。undefined はまだ分からない（session の読み込み中）、null は未ログイン。
 * 前の値が分かっていて、次の値と違うとき（ログアウト・別の人でのログイン）だけ true。
 */
export function sessionChanged(prev: string | null | undefined, next: string | null | undefined): boolean {
  if (prev === undefined || next === undefined) return false;
  return prev !== next;
}

/**
 * 画面が持つ表示状態（Today の「最後にそろっていた表示」など）は QueryClient の外にあり、キャッシュを消しても残る。
 * そこで「いまの利用者」と「その利用者のデータとして使ってよい取得の下限時刻（clearedAt）」を共有する。
 * - 利用者が変わった直後は clearedAt = Infinity（前の人の取得の中断が終わるまで、どのデータも使わない）
 * - 中断が終わった時刻を clearedAt にする。それより後に届いたデータは、新しい利用者の認証で始めた取得のもの
 * 画面はこの owner ごとに作り直し（保持していた表示を捨てる）、clearedAt より前のデータを表示に使わない。
 */
export type PrivateEpoch = { owner: string | null | undefined; clearedAt: number };

/** 利用者の識別が分かったときの次の状態。最初に分かったときは、すでにあるデータをそのまま使ってよい。 */
export function nextEpoch(prev: PrivateEpoch, userId: string | null | undefined): PrivateEpoch {
  if (userId === undefined || userId === prev.owner) return prev;
  if (prev.owner === undefined) return { owner: userId, clearedAt: 0 };
  return { owner: userId, clearedAt: Number.POSITIVE_INFINITY };
}

let epoch: PrivateEpoch = { owner: undefined, clearedAt: 0 };
const listeners = new Set<() => void>();
function setEpoch(next: PrivateEpoch) {
  if (next === epoch) return;
  epoch = next;
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** いまの利用者と、その利用者のデータとして使ってよい取得の下限時刻。 */
export function usePrivateEpoch(): PrivateEpoch {
  return useSyncExternalStore(subscribe, () => epoch);
}

/**
 * 利用者ごとの私的なデータ（Goal・Today・記録）を、ログインしている人が変わったときに止めて消す。
 * QueryClient は SPA の間ずっと共有されるため、消さないと、ログアウトして別の人がログインした後に
 * 前の人の Goal・記録・予測がキャッシュから見えてしまう（API の所有者チェックだけでは表示を防げない）。
 * - 取得の途中のものは中断する（queryFn が渡す AbortSignal で fetch を止める）
 * - ['goals'] の下を初期状態へ戻す（表示中のものは新しい利用者として取り直し、他人のものなら 404 になる）
 * - 画面が保持する表示状態のため、利用者と使ってよいデータの下限時刻（PrivateEpoch）を更新する
 */
export function PrivateCacheGuard() {
  const session = authClient.useSession();
  const queryClient = useQueryClient();
  const last = useRef<string | null | undefined>(undefined);
  const userId = session.isPending ? undefined : (session.data?.user.id ?? null);

  useEffect(() => {
    setEpoch(nextEpoch(epoch, userId));
    if (sessionChanged(last.current, userId)) {
      const owner = userId;
      void queryClient.cancelQueries({ queryKey: goalKeys.all }).then(() => {
        // 前の人の取得が止まった後なら、ここから先に届くデータは新しい利用者のもの
        if (epoch.owner === owner) setEpoch({ owner, clearedAt: Date.now() });
        return queryClient.resetQueries({ queryKey: goalKeys.all });
      });
    }
    if (userId !== undefined) last.current = userId;
  }, [userId, queryClient]);

  return null;
}
