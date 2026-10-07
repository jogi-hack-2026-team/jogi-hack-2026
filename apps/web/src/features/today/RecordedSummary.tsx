import type { Log } from '@contracts';
import { StatusBadge } from '../../ui/components/StatusBadge.tsx';
import { Button } from '../../ui/components/Button.tsx';
import { Icon } from '../../ui/components/Icon.tsx';
import { todayCopy } from '../../copy/today.ts';

/** 今日は記録済み（R-07）。比較（中心指標）は出さず、記録内容を出す。「記録を変更」で下の2択を選び直せるようにする（#79）。 */
export function RecordedSummary({ todayLog, unit, onChange }: { todayLog: Log; unit: string; onChange: () => void }) {
  return (
    <section className="fr-today__top" aria-labelledby="fr-recorded-title">
      <h1 id="fr-recorded-title" className="fr-today__question">
        {todayCopy.recordedTitle}
      </h1>
      <div className="fr-recorded">
        <div className="fr-recorded__value">
          <StatusBadge status={todayLog.status === 'DONE' ? 'done' : 'rest'} large />
          {todayLog.status === 'DONE' && todayLog.amount !== null ? (
            <span className="fr-recorded__amount">
              {todayLog.amount.toLocaleString('ja-JP')}
              {unit}
            </span>
          ) : null}
        </div>
        <Button icon="edit" onClick={onChange}>
          {todayCopy.changeRecord}
        </Button>
      </div>
    </section>
  );
}

/** 達成済み（R-08）。予測は出さない。 */
export function AchievedPanel({ total, unit }: { total: number; unit: string }) {
  return (
    <section className="fr-today__top fr-achieved" aria-labelledby="fr-achieved-title">
      <span className="fr-achieved__emblem" aria-hidden="true">
        <Icon name="check" size={36} strokeWidth={2.2} />
      </span>
      <h1 id="fr-achieved-title" className="fr-today__question">
        {todayCopy.achievedTitle}
      </h1>
      <p className="fr-today__summary">
        {total.toLocaleString('ja-JP')}
        {unit}。{todayCopy.achievedBody}
      </p>
    </section>
  );
}
