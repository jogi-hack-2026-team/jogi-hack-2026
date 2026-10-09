import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { authClient } from '../auth/client.ts';
import { goalKeys } from './goals-http.ts';
import { getPrivateGeneration, useDraftContinuityTracking, usePrivateGeneration } from './session-draft.ts';

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
let clearedGeneration = 0;
const waitingEpoch: PrivateEpoch = { owner: undefined, clearedAt: Number.POSITIVE_INFINITY };
/** 非query回復GET向けの境界。現時点の製品callerはなく、#175併用候補と実hook回帰用。確認/owner変更は描画前にも無効にする。 */
export function getPrivateEpoch(): PrivateEpoch {
  const session = authClient.$store?.atoms?.session?.get();
  if (getPrivateGeneration() !== clearedGeneration || session?.isPending || session?.isRefetching || session?.error ||
      (session && (session.data?.user.id ?? null) !== epoch.owner)) return waitingEpoch;
  return epoch;
}
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
  const stored = useSyncExternalStore(subscribe, () => epoch);
  const generation = usePrivateGeneration();
  const session = authClient.useSession();
  // effect の消去を待つ前の描画でも、いま認識している session と照合する。
  // 取得失敗は未ログインと取り違えず、私的な表示・入力だけを停止する。
  // 再取得中は旧 data が残り isPending=false でも、Cookie の所有者と一致するとは限らない。
  if (session.isPending || session.isRefetching || session.error || generation !== clearedGeneration) return { owner: undefined, clearedAt: Number.POSITIVE_INFINITY };
  return nextEpoch(stored, session.data?.user.id ?? null);
}

/** 取得・フォームを使えるのは、所有者が確定し、旧取得の中断と消去が終わったときだけ。 */
export function privateDataReady(current: PrivateEpoch): boolean {
  return typeof current.owner === 'string' && Number.isFinite(current.clearedAt);
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
  const generation = useDraftContinuityTracking(session);
  const queryClient = useQueryClient();
  const last = useRef<string | null | undefined>(undefined);
  const needsReset = useRef(false);
  const userId = session.isPending || session.isRefetching || session.error ? undefined : (session.data?.user.id ?? null);

  useEffect(() => {
    if (userId === undefined) {
      if (epoch.owner !== undefined) {
        // 確認中に届く業務応答を旧 session の所有物と見なさない。
        // 古い cancel 完了も無効にし、同じ owner で回復した場合にも cache を消す。
        needsReset.current = true;
        setEpoch({ owner: epoch.owner, clearedAt: Number.POSITIVE_INFINITY });
      }
      return;
    }
    const resetNeeded = needsReset.current || generation !== clearedGeneration;
    const transition = resetNeeded
      ? { owner: userId, clearedAt: Number.POSITIVE_INFINITY }
      : nextEpoch(epoch, userId);
    setEpoch(transition);
    if (resetNeeded || sessionChanged(last.current, userId)) {
      needsReset.current = false;
      const owner = userId;
      void queryClient.cancelQueries({ queryKey: goalKeys.all }).then(() => {
        // 前の人の取得が止まった後なら、ここから先に届くデータは新しい利用者のもの
        // A→B→A のような連続切替でも、古い中断完了で新しい境界を開かない。
        if (epoch !== transition || getPrivateGeneration() !== generation) return;
        // 先に消去する。時刻を公開してから reset すると、間に旧 cache を読めてしまう。
        const reset = queryClient.resetQueries({ queryKey: goalKeys.all });
        clearedGeneration = generation;
        // cache はすでに空。同じ millisecond に成功した新取得も許可する。
        setEpoch({ owner, clearedAt: Date.now() - 1 });
        return reset;
      });
    }
    if (userId !== undefined) last.current = userId;
  }, [userId, queryClient, generation]);

  return null;
}
