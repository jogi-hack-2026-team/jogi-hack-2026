import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { Goal } from '@contracts';
import { goalKeys, goalsHttp } from '../../api/goals-http.ts';
import { todayHttp, todayKeys } from '../../api/today-http.ts';
import { classifySaveError, TodayDateChangedError, toLogPut, type RecordChoice } from './record-log.ts';

export type RecordContext = Pick<Goal, 'id' | 'unit' | 'timezone' | 'goalSettingsRevision'>;
export type SaveVars = { goalId: string; localDate: string; choice: RecordChoice;
  expectedGoalSettingsRevision: number; unit: Goal['unit']; timezone: string };
export const saveLogKey = (goalId: string) => ['putLog', goalId] as const;
export const isSaveFor = (localDate: string, vars: unknown) => (vars as SaveVars | undefined)?.localDate === localDate;

// 再試行では現画面の既定量を参照しない。利用者が押した時点の意味と値を保存操作へ固定する。
export function captureSave(context: RecordContext, localDate: string, choice: RecordChoice): SaveVars {
  return { goalId: context.id, localDate, choice: { ...choice }, expectedGoalSettingsRevision: context.goalSettingsRevision,
    unit: context.unit, timezone: context.timezone };
}
export function rebaseSave(vars: SaveVars, latest: RecordContext): SaveVars | null {
  if (latest.id !== vars.goalId || latest.unit !== vars.unit || latest.timezone !== vars.timezone) return null;
  return { ...vars, expectedGoalSettingsRevision: latest.goalSettingsRevision };
}

export function useSaveLog(goalId: string, { onSaved, localDate, canSaveDate, context }: {
  onSaved?: () => void; localDate?: string | undefined;
  canSaveDate?: (date: string) => boolean; context?: RecordContext | undefined;
} = {}) {
  const queryClient = useQueryClient();
  const inFlight = useRef(false);
  const canSaveDateRef = useRef(canSaveDate);
  canSaveDateRef.current = canSaveDate;
  const dateAllowed = (date: string) => canSaveDateRef.current?.(date) ?? true;
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [latest, setLatest] = useState<RecordContext | null>(null);
  const [reloadingSettings, setReloadingSettings] = useState(false);
  const [settingsReloadFailed, setSettingsReloadFailed] = useState(false);
  const reloadInFlight = useRef(false);
  const mutation = useMutation({
    mutationKey: saveLogKey(goalId), retry: false,
    mutationFn: (vars: SaveVars) => {
      if (!dateAllowed(vars.localDate)) throw new TodayDateChangedError();
      return todayHttp.putLog(vars.goalId, vars.localDate, toLogPut(vars.choice, vars.expectedGoalSettingsRevision));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: goalKeys.all });
      setRefreshFailed([todayKeys.today(goalId), todayKeys.logs(goalId)].some(key => queryClient.getQueryState(key)?.status === 'error'));
      onSaved?.();
    },
    onError: () => setLatest(null),
    onSettled: () => { inFlight.current = false; },
  });
  const pending = useMutationState({ filters: { mutationKey: saveLogKey(goalId), status: 'pending' },
    select: m => m.state.variables as SaveVars | undefined });
  const pendingForDate = localDate === undefined ? undefined : pending.find(vars => vars?.localDate === localDate);
  const conflict = mutation.isError && classifySaveError(mutation.error) === 'settings';
  const rebased = latest && mutation.variables ? rebaseSave(mutation.variables, latest) : null;
  const submit = (vars: SaveVars) => {
    if (!dateAllowed(vars.localDate) || inFlight.current || reloadInFlight.current) return;
    if (queryClient.isMutating({ mutationKey: saveLogKey(goalId), predicate: m => isSaveFor(vars.localDate, m.state.variables) }) > 0) return;
    inFlight.current = true; setRefreshFailed(false); mutation.mutate(vars);
  };
  return {
    save: (vars: { localDate: string; choice: RecordChoice }) => {
      if (conflict || !context) return;
      submit(captureSave(context, vars.localDate, vars.choice));
    },
    canSaveDate: dateAllowed,
    retry: () => {
      const vars = conflict ? rebased : mutation.variables;
      if (vars) submit(vars);
    },
    // 409は取得成功まで消さない。意味が変わった場合、成功後に利用者が明示的に選び直す。
    reset: () => {
      if (conflict && !latest) return;
      mutation.reset(); setLatest(null); setSettingsReloadFailed(false);
    },
    reloadSettings: async () => {
      if (!conflict || reloadInFlight.current || inFlight.current) return;
      reloadInFlight.current = true; setReloadingSettings(true); setLatest(null);
      try {
        const goal = await goalsHttp.getGoal(goalId);
        setLatest(goal); setSettingsReloadFailed(false);
        queryClient.setQueryData(goalKeys.detail(goalId), goal);
        await queryClient.invalidateQueries({ queryKey: goalKeys.all });
      } catch { setSettingsReloadFailed(true); }
      finally { reloadInFlight.current = false; setReloadingSettings(false); }
    },
    settingsReady: conflict && latest !== null,
    meaningChanged: conflict && latest !== null && rebased === null,
    reloadingSettings, settingsReloadFailed,
    refreshFailed,
    isSaving: mutation.isPending || pendingForDate !== undefined,
    saving: mutation.isPending ? mutation.variables : pendingForDate,
    failure: mutation.isError ? { error: mutation.error, vars: mutation.variables } : undefined,
    isSuccess: mutation.isSuccess,
  };
}
