import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
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
 * 利用者ごとの私的なデータ（Goal・Today・記録）を、ログインしている人が変わったときに止めて消す。
 * QueryClient は SPA の間ずっと共有されるため、消さないと、ログアウトして別の人がログインした後に
 * 前の人の Goal・記録・予測がキャッシュから見えてしまう（API の所有者チェックだけでは表示を防げない）。
 * - 取得の途中のものは中断する（queryFn が渡す AbortSignal で fetch を止める）
 * - ['goals'] の下を初期状態へ戻す（表示中のものは新しい利用者として取り直し、他人のものなら 404 になる）
 */
export function PrivateCacheGuard() {
  const session = authClient.useSession();
  const queryClient = useQueryClient();
  const last = useRef<string | null | undefined>(undefined);
  const userId = session.isPending ? undefined : (session.data?.user.id ?? null);

  useEffect(() => {
    if (sessionChanged(last.current, userId)) {
      void queryClient.cancelQueries({ queryKey: goalKeys.all }).then(() => queryClient.resetQueries({ queryKey: goalKeys.all }));
    }
    if (userId !== undefined) last.current = userId;
  }, [userId, queryClient]);

  return null;
}
