import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { goalKeys } from '../../api/goals-http.ts';
import { todayHttp, todayKeys } from '../../api/today-http.ts';
import { toLogPut, type RecordChoice } from './record-log.ts';

type Vars = { localDate: string; choice: RecordChoice };

/**
 * 1日分の記録を保存する（今日の記録と昨日の補完で別々に使う）。
 * - 保存が終わるまで二重に送らない。状態（isPending）は再描画まで切り替わらないため、即座に変わる目印も持つ
 * - 保存に成功したら、Goal・Today・記録の一覧をまとめて取り直し、取り直しが終わるまで「保存中」のままにする
 *   （古い予測や「未記録」の表示が一瞬戻らないようにするため）
 * - 失敗したら何も書き換えず、同じ内容で再試行できるよう、送ろうとした内容（variables）を残す
 * - 保存は成功したのに取り直し（Today・記録の一覧）が失敗したときは refreshFailed を立て、「保存できなかった」と区別して伝える
 */
export function useSaveLog(goalId: string, { onSaved }: { onSaved?: () => void } = {}) {
  const queryClient = useQueryClient();
  const inFlight = useRef(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const mutation = useMutation({
    mutationFn: ({ localDate, choice }: Vars) => todayHttp.putLog(goalId, localDate, toLogPut(choice)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: goalKeys.all });
      const failed = [todayKeys.today(goalId), todayKeys.logs(goalId)].some((key) => queryClient.getQueryState(key)?.status === 'error');
      setRefreshFailed(failed);
      onSaved?.();
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });
  const save = (vars: Vars) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshFailed(false);
    mutation.mutate(vars);
  };
  return {
    save,
    /** 失敗した内容で、もう一度保存する。 */
    retry: () => {
      if (mutation.variables) save(mutation.variables);
    },
    /** 失敗の表示を消して、選び直せるようにする。 */
    reset: () => mutation.reset(),
    /** 保存は成功したが、Today・記録の一覧の取り直しに失敗した（表示は古いかもしれない）。 */
    refreshFailed,
    isSaving: mutation.isPending,
    saving: mutation.isPending ? mutation.variables : undefined,
    failure: mutation.isError ? { error: mutation.error, vars: mutation.variables } : undefined,
    isSuccess: mutation.isSuccess,
  };
}
