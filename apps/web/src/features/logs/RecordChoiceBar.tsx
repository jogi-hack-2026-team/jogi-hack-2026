import { useEffect, useRef, useState } from 'react';
import { longDate } from '../../copy/date.ts';
import { ErrorPanel } from '../../ui/components/Notice.tsx';
import type { Log } from '@contracts';
import { amountFormat, RECORD_AMOUNT_MAX, RECORD_AMOUNT_MIN, stepRecordAmount, type AmountFormat } from '../../copy/amount.ts';
import { todayCopy } from '../../copy/today.ts';
import { Button, IconButton } from '../../ui/components/Button.tsx';
import { ChoiceButton } from '../../ui/components/ChoiceButton.tsx';
import { StickyActionBar } from '../../ui/components/StickyActionBar.tsx';
import { AmountEditor } from './AmountEditor.tsx';
import { classifySaveError, describeChoice, unlessLocked, type RecordChoice } from './record-log.ts';
import { SaveFailure } from './SaveFailure.tsx';
import type { useSaveLog } from './useSaveLog.ts';
import './logs.css';

/**
 * 今日の記録の2択（R-03、#79）。画面の下に固定し、スクロールに追従する。
 * 予測の表示が失敗しても操作できるよう、予測の Error Boundary の外に置く。
 * 「やった」「今日は休む」は1回押すだけで保存する（やった量は1回の量）。量を変えたいときは「量を変更」から。
 * current があるときは記録の変更（D5-change）：今の記録を選択中として出し、選び直すと上書きする。
 * 量の入力を開いているかは親（TodayPage）が持つ。開いている間は昨日の訂正を始められないようにするため。
 */
export function RecordChoiceBar({
  today,
  sessionAmount,
  fmt,
  current,
  saver,
  onCancelChange,
  onRefresh,
  locked = false,
  editingAmount,
  onEditingAmountChange,
}: {
  today: string;
  sessionAmount: number;
  /** 量の書き方（1回の量は分か回。P-18）。 */
  fmt: AmountFormat;
  current?: Log | null;
  saver: ReturnType<typeof useSaveLog>;
  onCancelChange?: () => void;
  onRefresh: () => void;
  /** 昨日の記録を訂正している間は押せなくする（今日と昨日を同時に編集しない）。 */
  locked?: boolean;
  /** 量の入力を開いているか（親が持つ）。 */
  editingAmount: boolean;
  onEditingAmountChange: (editing: boolean) => void;
}) {
  const label = fmt.record;
  const currentAmount = current?.status === 'DONE' && current.amount !== null ? current.amount : sessionAmount;
  const [steppedInitial, setSteppedInitial] = useState<number | null>(null);
  const amountLink = useRef<HTMLButtonElement>(null);
  const amountControls = useRef<HTMLSpanElement>(null);
  const amountEntry = useRef<-1 | 1 | undefined>(undefined);
  const returnFocus = useRef(false);
  useEffect(() => {
    if (!editingAmount && returnFocus.current) {
      returnFocus.current = false;
      const label = amountEntry.current === 1 ? todayCopy.amountIncrease : amountEntry.current === -1 ? todayCopy.amountDecrease : undefined;
      const trigger = label ? [...(amountControls.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find(button => button.getAttribute('aria-label')?.startsWith(label)) : amountLink.current;
      (trigger && !trigger.disabled ? trigger : amountLink.current)?.focus();
    }
  }, [editingAmount]);
  const openAmount = (direction?: -1 | 1) => {
    if (saver.isSaving || locked) return;
    amountEntry.current = direction;
    setSteppedInitial(direction ? stepRecordAmount(currentAmount, sessionAmount, direction) : null);
    onEditingAmountChange(true);
  };
  const closeAmount = () => {
    returnFocus.current = true;
    setSteppedInitial(null);
    onEditingAmountChange(false);
  };
  // 昨日を訂正している間は、量の入力からも送らない
  const save = (choice: RecordChoice) => (locked ? undefined : saver.save({ localDate: today, choice }));
  const saving = saver.saving?.choice;

  // 失敗した保存の再試行は、その variables の日付も検査する（表示が翌日へ更新された後も）。
  const staleDate = saver.isStaleDate(today) ? today
    : saver.failure?.vars && saver.isStaleDate(saver.failure.vars.localDate) ? saver.failure.vars.localDate : undefined;
  if (staleDate && !saver.isSaving) {
    return (
      <StickyActionBar>
        <ErrorPanel title={todayCopy.dateChangedTitle} action={<Button variant="primary" block onClick={onRefresh}>{todayCopy.refresh}</Button>}>
          {todayCopy.dateChanged(longDate(staleDate))}
        </ErrorPanel>
      </StickyActionBar>
    );
  }

  if (saver.failure?.vars) {
    const failed = saver.failure.vars.choice;
    return (
      <StickyActionBar>
        <SaveFailure
          settings={{ ready: saver.settingsReady, meaningChanged: saver.meaningChanged, loading: saver.reloadingSettings, failed: saver.settingsReloadFailed, reload: saver.reloadSettings }}
          kind={classifySaveError(saver.failure.error)}
          body={todayCopy.saveFailed(describeChoice(failed, sessionAmount, amountFormat({ unit: saver.failure.vars.unit }).record, todayCopy.recordedRest))}
          localDate={saver.failure.vars.localDate}
          // 昨日を訂正している間は、失敗後の再試行からも送らない（通常の保存と同じ排他）
          onRetry={unlessLocked(locked, saver.retry)}
          retryLocked={locked}
          lockedNote={todayCopy.otherEditing}
          onReselect={saver.reset}
          onRefresh={() => {
            saver.reset();
            onRefresh();
          }}
        />
      </StickyActionBar>
    );
  }

  if (editingAmount) {
    return (
      <StickyActionBar>
        <AmountEditor
          label={todayCopy.amountTodayLabel}
          initial={steppedInitial ?? currentAmount}
          sessionAmount={sessionAmount}
          fmt={fmt}
          busy={saver.isSaving || locked}
          onSubmit={(amount) => save({ status: 'DONE', amount })}
          onCancel={closeAmount}
        />
      </StickyActionBar>
    );
  }

  const note = saver.isSaving ? (
    todayCopy.savingNote
  ) : locked ? (
    todayCopy.otherEditing
  ) : (
    <span className="fr-record__note">
      {current ? <span>{todayCopy.changeNote}</span> : null}
      <span ref={amountControls} className="fr-record__amount-controls">
        {todayCopy.doneAmount(label(current ? currentAmount : sessionAmount))}
        <IconButton icon="minus" label={`${todayCopy.amountDecrease}（${label(sessionAmount)}ずつ）`} disabled={currentAmount <= RECORD_AMOUNT_MIN} onClick={() => openAmount(-1)} />
        <IconButton icon="plus" label={`${todayCopy.amountIncrease}（${label(sessionAmount)}ずつ）`} disabled={currentAmount >= RECORD_AMOUNT_MAX} onClick={() => openAmount(1)} />
        <Button ref={amountLink} variant="text" onClick={() => openAmount()}>
          {todayCopy.changeAmount}
        </Button>
        {current && onCancelChange ? (
          <Button variant="text" onClick={onCancelChange}>
            {todayCopy.cancelChange}
          </Button>
        ) : null}
      </span>
    </span>
  );

  return (
    <StickyActionBar columns={2} note={note}>
      <ChoiceButton
        kind="done"
        label={todayCopy.choiceDone}
        sublabel={label(current ? currentAmount : sessionAmount)}
        selected={current?.status === 'DONE'}
        busy={saving?.status === 'DONE'}
        busyLabel={todayCopy.saving}
        disabled={saver.isSaving || locked}
        onClick={() => save({ status: 'DONE', amount: current ? currentAmount : sessionAmount })}
      />
      <ChoiceButton
        kind="rest"
        label={todayCopy.choiceRest}
        selected={current?.status === 'SKIPPED'}
        busy={saving?.status === 'SKIPPED'}
        busyLabel={todayCopy.saving}
        disabled={saver.isSaving || locked}
        onClick={() => save({ status: 'SKIPPED', amount: null })}
      />
    </StickyActionBar>
  );
}
