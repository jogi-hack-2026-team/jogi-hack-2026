import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { goalKeys } from '../../api/goals-http.ts';
import { todayHttp, todayKeys } from '../../api/today-http.ts';
import { TodayDateChangedError, toLogPut, type RecordChoice } from './record-log.ts';

export type SaveVars = { localDate: string; choice: RecordChoice };

/** 記録の保存を Goal ごとに見分ける名前。画面を作り直しても、同じ Goal・同じ日の保存が残っているかを調べられる。 */
export const saveLogKey = (goalId: string) => ['putLog', goalId] as const;

/** 保存の内容が、その日の記録か。 */
export const isSaveFor = (localDate: string, vars: unknown) => (vars as SaveVars | undefined)?.localDate === localDate;

/**
 * 1日分の記録を保存する（今日の記録と、昨日の補完・訂正で別々に使う）。
 * - 保存が終わるまで二重に送らない。状態（isPending）は再描画まで切り替わらないため、即座に変わる目印も持つ
 * - 同じ Goal・同じ日の保存がまだ終わっていなければ、画面を作り直した後（一覧へ戻って開き直した等）でも送らず、
 *   その保存を「保存中」として出す。前の保存が後から届いて新しい選択を上書きする順序の食い違いを防ぐため
 * - 保存に成功したら、Goal・Today・記録の一覧をまとめて取り直し、取り直しが終わるまで「保存中」のままにする
 *   （古い予測や「未記録」の表示が一瞬戻らないようにするため）。画面を離れていても取り直しは行う
 * - 失敗したら何も書き換えず、同じ内容で再試行できるよう、送ろうとした内容（variables）を残す
 * - 保存は成功したのに取り直し（Today・記録の一覧）が失敗したときは refreshFailed を立て、「保存できなかった」と区別して伝える
 *
 * localDate を渡すと、その日の保存（別の画面で始めたものを含む）を「保存中」として扱う。
 */
export function useSaveLog(goalId: string, { onSaved, localDate, canSaveDate }: {
  onSaved?: () => void;
  localDate?: string | undefined;
  /** 今日の操作だけに渡す送信日付の検査。通常保存・量変更・失敗後の再試行に共通で効く。 */
  canSaveDate?: (date: string) => boolean;
} = {}) {
  const queryClient = useQueryClient();
  const inFlight = useRef(false);
  const canSaveDateRef = useRef(canSaveDate);
  canSaveDateRef.current = canSaveDate;
  const dateAllowed = (date: string) => canSaveDateRef.current?.(date) ?? true;
  const [refreshFailed, setRefreshFailed] = useState(false);
  const mutation = useMutation({
    mutationKey: saveLogKey(goalId),
    mutationFn: ({ localDate: date, choice }: SaveVars) => {
      // mutate から実際の送信までに新しい API 応答が届いても、古い日付へ送らない
      if (!dateAllowed(date)) throw new TodayDateChangedError();
      return todayHttp.putLog(goalId, date, toLogPut(choice));
    },
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

  // この Goal でまだ終わっていない保存（作り直す前の画面で始めたものも含む）
  const pending = useMutationState({
    filters: { mutationKey: saveLogKey(goalId), status: 'pending' },
    select: (m) => m.state.variables as SaveVars | undefined,
  });
  const pendingForDate = localDate === undefined ? undefined : pending.find((vars) => vars?.localDate === localDate);

  const save = (vars: SaveVars) => {
    if (!dateAllowed(vars.localDate) || inFlight.current) return;
    // 同じ日の保存が残っている間は送らない（画面を作り直しても効くよう、QueryClient の記録で確かめる）
    if (queryClient.isMutating({ mutationKey: saveLogKey(goalId), predicate: (m) => isSaveFor(vars.localDate, m.state.variables) }) > 0) return;
    inFlight.current = true;
    setRefreshFailed(false);
    mutation.mutate(vars);
  };
  return {
    save,
    canSaveDate: dateAllowed,
    /** 失敗した内容で、もう一度保存する。 */
    retry: () => {
      if (mutation.variables) save(mutation.variables);
    },
    /** 失敗の表示を消して、選び直せるようにする。 */
    reset: () => mutation.reset(),
    /** 保存は成功したが、Today・記録の一覧の取り直しに失敗した（表示は古いかもしれない）。 */
    refreshFailed,
    isSaving: mutation.isPending || pendingForDate !== undefined,
    saving: mutation.isPending ? mutation.variables : pendingForDate,
    failure: mutation.isError ? { error: mutation.error, vars: mutation.variables } : undefined,
    isSuccess: mutation.isSuccess,
  };
}
