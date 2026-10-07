import { useState } from 'react';
import { Button } from '../../ui/components/Button.tsx';
import { ErrorPanel } from '../../ui/components/Notice.tsx';
import { longDate } from '../../copy/date.ts';
import { todayCopy } from '../../copy/today.ts';
import { AmountEditor } from './AmountEditor.tsx';
import { classifySaveError, type RecordChoice } from './record-log.ts';
import { SaveFailure } from './SaveFailure.tsx';
import type { useSaveLog } from './useSaveLog.ts';
import './logs.css';

/**
 * 「昨日はどうでしたか？」（R-04、#80）。出す条件は /today の yesterdayMissing だけを見る（開始日の条件は API 側で含める）。
 * 1回押すだけで昨日を記録する（やった量は1回の量。「量を変更」で変えられる）。
 * 保存に成功すると /today を取り直し、yesterdayMissing が false になって消える（成功したときだけ消える）。
 * 失敗したら「まだ入っていない」と出し、もう一度選べる。「後で答える」はデータを作らない。
 */
export function YesterdayPrompt({
  yesterday,
  sessionAmount,
  unit,
  saver,
  onLater,
  onRefresh,
}: {
  yesterday: string;
  sessionAmount: number;
  unit: string;
  saver: ReturnType<typeof useSaveLog>;
  onLater: () => void;
  onRefresh: () => void;
}) {
  const [editingAmount, setEditingAmount] = useState(false);
  const save = (choice: RecordChoice) => saver.save({ localDate: yesterday, choice });
  const saving = saver.saving?.choice;
  const failureKind = saver.failure ? classifySaveError(saver.failure.error) : null;

  let body;
  if (failureKind === 'signed-out' || failureKind === 'date') {
    // ログイン切れ・記録できない日は、選び直しても保存できないため、先にその対処を出す
    body = (
      <SaveFailure
        kind={failureKind}
        body=""
        localDate={yesterday}
        onRetry={saver.retry}
        onReselect={saver.reset}
        onRefresh={() => {
          saver.reset();
          onRefresh();
        }}
      />
    );
  } else if (editingAmount) {
    body = (
      <AmountEditor
        label={todayCopy.amountYesterdayLabel}
        initial={sessionAmount}
        sessionAmount={sessionAmount}
        unit={unit}
        busy={saver.isSaving}
        onSubmit={(amount) => save({ status: 'DONE', amount })}
        onCancel={() => setEditingAmount(false)}
      />
    );
  } else {
    body = (
      <>
        <div className="fr-yesterday__pair">
          <Button icon="check" busy={saving?.status === 'DONE'} disabled={saver.isSaving} onClick={() => save({ status: 'DONE', amount: null })}>
            {saving?.status === 'DONE' ? todayCopy.saving : todayCopy.yesterdayDone}
          </Button>
          <Button icon="moon" busy={saving?.status === 'SKIPPED'} disabled={saver.isSaving} onClick={() => save({ status: 'SKIPPED', amount: null })}>
            {saving?.status === 'SKIPPED' ? todayCopy.saving : todayCopy.yesterdayRest}
          </Button>
        </div>
        <p className="fr-yesterday__amount">
          {todayCopy.doneAmount(`${sessionAmount.toLocaleString('ja-JP')}${unit}`)}
          <Button variant="text" disabled={saver.isSaving} onClick={() => setEditingAmount(true)}>
            {todayCopy.changeAmount}
          </Button>
        </p>
        <Button variant="text" disabled={saver.isSaving} onClick={onLater}>
          {todayCopy.yesterdayLater}
        </Button>
      </>
    );
  }

  return (
    <section className="fr-yesterday" aria-labelledby="fr-yesterday-title">
      <div className="fr-yesterday__head">
        <h2 id="fr-yesterday-title" className="fr-yesterday__title">
          {todayCopy.yesterdayQuestion}
        </h2>
        <span className="fr-yesterday__date">{longDate(yesterday)}</span>
      </div>
      {/* 通信・サーバーの失敗は、選び直せるよう2択の上に出す（E3-failed） */}
      {failureKind === 'failed' ? <ErrorPanel title={todayCopy.saveFailedTitle}>{todayCopy.yesterdayFailed}</ErrorPanel> : null}
      {body}
    </section>
  );
}
