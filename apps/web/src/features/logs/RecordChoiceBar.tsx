import { useState } from 'react';
import type { Log } from '@contracts';
import { todayCopy } from '../../copy/today.ts';
import { Button } from '../../ui/components/Button.tsx';
import { ChoiceButton } from '../../ui/components/ChoiceButton.tsx';
import { StickyActionBar } from '../../ui/components/StickyActionBar.tsx';
import { AmountEditor } from './AmountEditor.tsx';
import { classifySaveError, describeChoice, type RecordChoice } from './record-log.ts';
import { SaveFailure } from './SaveFailure.tsx';
import type { useSaveLog } from './useSaveLog.ts';
import './logs.css';

/**
 * 今日の記録の2択（R-03、#79）。画面の下に固定し、スクロールに追従する。
 * 予測の表示が失敗しても操作できるよう、予測の Error Boundary の外に置く。
 * 「やった」「今日は休む」は1回押すだけで保存する（やった量は1回の量）。量を変えたいときは「量を変更」から。
 * current があるときは記録の変更（D5-change）：今の記録を選択中として出し、選び直すと上書きする。
 */
export function RecordChoiceBar({
  today,
  sessionAmount,
  unit,
  current,
  saver,
  onCancelChange,
  onRefresh,
  locked = false,
}: {
  today: string;
  sessionAmount: number;
  unit: string;
  current?: Log | null;
  saver: ReturnType<typeof useSaveLog>;
  onCancelChange?: () => void;
  onRefresh: () => void;
  /** 昨日の記録を訂正している間は押せなくする（今日と昨日を同時に編集しない）。 */
  locked?: boolean;
}) {
  const [editingAmount, setEditingAmount] = useState(false);
  const label = (n: number) => `${n.toLocaleString('ja-JP')}${unit}`;
  const currentAmount = current?.status === 'DONE' && current.amount !== null ? current.amount : sessionAmount;
  const save = (choice: RecordChoice) => saver.save({ localDate: today, choice });
  const saving = saver.saving?.choice;

  if (saver.failure?.vars) {
    const failed = saver.failure.vars.choice;
    return (
      <StickyActionBar>
        <SaveFailure
          kind={classifySaveError(saver.failure.error)}
          body={todayCopy.saveFailed(describeChoice(failed, sessionAmount, unit, todayCopy.recordedRest))}
          localDate={saver.failure.vars.localDate}
          onRetry={saver.retry}
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
          initial={currentAmount}
          sessionAmount={sessionAmount}
          unit={unit}
          busy={saver.isSaving}
          onSubmit={(amount) => save({ status: 'DONE', amount })}
          onCancel={() => setEditingAmount(false)}
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
      <span>
        {todayCopy.doneAmount(label(current ? currentAmount : sessionAmount))}
        <Button variant="text" onClick={() => setEditingAmount(true)}>
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
        onClick={() => save({ status: 'DONE', amount: current?.status === 'DONE' ? currentAmount : null })}
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
