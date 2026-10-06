import { Band } from '../../ui/components/Section.tsx';
import { InsufficientNotice } from '../../ui/components/Notice.tsx';
import { todayCopy } from '../../copy/today.ts';
import { outlookAxis } from './chart-geometry.ts';
import type { CompletionPresentation } from '../prior/presentation-types.ts';

/** これからの見通し（補助指標2）。目安と「10回中8回」の日付を、実際の日付に比例した軸に置く。 */
export function OutlookPanel({ completion, today, title }: { completion: CompletionPresentation; today: string; title: string }) {
  return (
    <Band label={todayCopy.outlookLabel} labelledBy="fr-outlook-title">
      <h2 id="fr-outlook-title" className="fr-outlook__title">
        {title}
      </h2>
      {completion.kind === 'estimate' ? (
        <Estimate completion={completion} today={today} />
      ) : completion.kind === 'insufficient' ? (
        <InsufficientNotice>{completion.message}</InsufficientNotice>
      ) : (
        // 条件付きの回数は記録だけのモードでは出ない（D-26 の採択後に表示を決める）
        <InsufficientNotice>{completion.reason}</InsufficientNotice>
      )}
    </Band>
  );
}

function Estimate({ completion, today }: { completion: Extract<CompletionPresentation, { kind: 'estimate' }>; today: string }) {
  const label = completion.scenario === 'TODAY_DONE' ? todayCopy.completionLabelTodayDone : todayCopy.completionLabelCurrent;
  return (
    <>
      <div className="fr-outlook__estimate">
        <p className="fr-outlook__label">{label}</p>
        <p className="fr-outlook__p50">{completion.p50Label ? todayCopy.completionP50(completion.p50Label) : todayCopy.over3Years}</p>
        <p className="fr-outlook__p80">{completion.p80Label ? todayCopy.completionP80(completion.p80Label) : todayCopy.completionP80Over3Years}</p>
      </div>
      {completion.p50Days !== null ? (
        <AxisChart today={today} p50Days={completion.p50Days} p80Days={completion.p80Days} sameWeek={completion.p50Label === completion.p80Label} />
      ) : null}
      <p className="fr-note">
        {todayCopy.completionNote}
        {todayCopy.axisNote}
      </p>
    </>
  );
}

/** 端の印はラベルが図の外にはみ出さないよう、寄せる向きを変える。 */
function labelAnchor(x: number): 'start' | 'middle' | 'end' {
  if (x < 60) return 'start';
  if (x > 290) return 'end';
  return 'middle';
}

function AxisChart({ today, p50Days, p80Days, sameWeek }: { today: string; p50Days: number; p80Days: number | null; sameWeek: boolean }) {
  const axis = outlookAxis(today, p50Days, p80Days, sameWeek);
  const description =
    p80Days === null
      ? `日付の軸。目安の日付に印。10回中8回の日付は3年以上先です。`
      : axis.sameWeek
        ? `日付の軸。目安も10回中8回の日付も同じ週です。`
        : `日付の軸。今日から目安の日付、10回中8回の日付の順に印。`;
  return (
    <svg className="fr-chart" viewBox="0 0 350 130" role="img" aria-label={description}>
      <line x1="20" y1="92" x2="334" y2="92" className="fr-chart__axis" />
      {axis.ticks.map((t) => (
        <g key={`${t.label}-${t.x}`}>
          <line x1={t.x} y1="92" x2={t.x} y2="97" className="fr-chart__axis" />
          <text x={t.x} y="112" textAnchor="middle" className="fr-chart__text">
            {t.label}
          </text>
          {t.yearLabel ? (
            <text x={t.x} y="128" textAnchor="middle" className="fr-chart__text">
              {t.yearLabel}
            </text>
          ) : null}
        </g>
      ))}
      <line x1="20" y1="84" x2="20" y2="97" className="fr-chart__today" />
      <text x="20" y="112" textAnchor="start" className="fr-chart__text fr-chart__text--strong">
        今日
      </text>
      {axis.markers.map((m) => (
        <g key={m.kind}>
          <line x1={m.x} y1="62" x2={m.x} y2="92" className="fr-chart__marker-line" />
          {/* 塗り＝目安、白抜き＝10回中8回（色だけに頼らない） */}
          <circle cx={m.x} cy="58" r="7" className={m.kind === 'p50' ? 'fr-chart__dot' : 'fr-chart__dot fr-chart__dot--open'} />
          <text x={m.x} y={m.labelY} textAnchor={labelAnchor(m.x)} className="fr-chart__text">
            {m.kind === 'p50' ? (axis.sameWeek ? '目安・10回中8回' : '目安') : '10回中8回'}
          </text>
        </g>
      ))}
    </svg>
  );
}
