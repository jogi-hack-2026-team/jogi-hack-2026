import { InsufficientNotice } from '../../ui/components/Notice.tsx';
import { Icon } from '../../ui/components/Icon.tsx';
import { todayCopy } from '../../copy/today.ts';
import type { Counts, CorePresentation } from '../prior/presentation-types.ts';

/** 問い・中心の数字・要約・計算の根拠（デザイン案Bの上部）。 */
export function CoreMetric({ core, resumed }: { core: CorePresentation; resumed: Counts }) {
  if (core.kind === 'insufficient') {
    return <InsufficientNotice>{core.message ?? todayCopy.insufficientCore}</InsufficientNotice>;
  }
  return (
    <>
      <div className="fr-core">
        <p className="fr-core__label">{todayCopy.coreLabel}</p>
        <p className="fr-core__value">
          <small>約</small>
          {core.days}
          <small>日</small>
        </p>
      </div>
      <p className="fr-today__summary">{todayCopy.coreSummary}</p>
      <ResumedLine resumed={resumed} />
      <WhyDetails />
    </>
  );
}

/** 補助指標1「休んだ翌日にやれたのは {nSD+nSS}回中{nSD}回」（Product Spec P-12）。0件のときは出さない（中心指標が不足になるため）。 */
export function ResumedLine({ resumed }: { resumed: Counts }) {
  if (resumed.total === 0) return null;
  return (
    <p className="fr-resumed">
      <span>{todayCopy.resumedLabel}</span>
      <strong>{todayCopy.resumed(resumed.success, resumed.total)}</strong>
    </p>
  );
}

/** 計算の根拠（開閉）。中心指標の注釈（Product Spec の固定文言）の全文をここに置く。 */
export function WhyDetails() {
  return (
    <details className="fr-why">
      <summary>
        {todayCopy.whyTitle}
        <Icon name="chevronDown" size={20} />
      </summary>
      <div className="fr-why__body">
        <p>{todayCopy.coreNote}</p>
      </div>
    </details>
  );
}
