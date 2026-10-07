import { InsufficientNotice } from '../../ui/components/Notice.tsx';
import { Icon } from '../../ui/components/Icon.tsx';
import { coreNoteFor, todayCopy } from '../../copy/today.ts';
import { sourceLabel, sourceNote } from '../prior/PriorForecast.tsx';
import type { Counts, CorePresentation, SufficientSource } from '../prior/presentation-types.ts';

/**
 * 問い・中心の数字・要約・計算の根拠（デザイン案Bの上部）。
 * R-11 で回答由来の数字のときは、出所（「回答」「回答＋実績」）を数字の下に出し、要約も出所に合わせる（デザインキャンバス R2・R3）。
 * 記録だけのときは、Product Spec P-12 の固定文言のまま。
 */
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
      {core.source === 'RECORDS' ? null : (
        <p className="fr-source-row">
          <span className="fr-source">{sourceLabel(core.source)}</span>
        </p>
      )}
      <p className="fr-today__summary">{core.source === 'RECORDS' ? todayCopy.coreSummary : sourceNote(core.source)}</p>
      <ResumedLine resumed={resumed} />
      <WhyDetails source={core.source} />
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

/** 計算の根拠（開閉）。中心指標の注釈の全文をここに置く。記録だけのときは Product Spec の固定文言、回答を使うときは出所に合わせた文言。 */
export function WhyDetails({ source = 'RECORDS' }: { source?: SufficientSource }) {
  return (
    <details className="fr-why">
      <summary>
        {todayCopy.whyTitle}
        <Icon name="chevronDown" size={20} />
      </summary>
      <div className="fr-why__body">
        <p>{coreNoteFor(source)}</p>
        {source === 'RECORDS' ? null : <p>{todayCopy.whyQuestion}</p>}
      </div>
    </details>
  );
}
