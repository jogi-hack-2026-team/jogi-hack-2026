import { Band } from '../../ui/components/Section.tsx';
import { InsufficientNotice } from '../../ui/components/Notice.tsx';
import { todayCopy } from '../../copy/today.ts';
import { useElementWidth } from '../../ui/useElementWidth.ts';
import { DEFAULT_CHART_WIDTH, outlookAxis } from './chart-geometry.ts';
import { sourceLabel } from '../prior/PriorForecast.tsx';
import type { CompletionPresentation, Plan } from '../prior/presentation-types.ts';

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
        // 材料が足りないときの、設定量で行う場合の残り（R-11、デザインキャンバス R2・R4）。日数の予測ではない
        <PlanView plan={completion.plan} reason={completion.reason} />
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
      <SourceRows sources={completion.sources} />
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

/** a／b 別の出所（R-11）。どちらも記録だけなら出さない（記録だけのモードの表示を変えない）。 */
function SourceRows({ sources }: { sources: Extract<CompletionPresentation, { kind: 'estimate' }>['sources'] }) {
  if (sources.a === 'RECORDS' && sources.b === 'RECORDS') return null;
  return (
    <div className="fr-sources">
      <dl className="fr-sources__list" aria-label={todayCopy.sourcesTitle}>
        <div>
          <dt>{todayCopy.sourceA}</dt>
          <dd>
            <span className="fr-source">{sourceLabel(sources.a)}</span>
          </dd>
        </div>
        <div>
          <dt>{todayCopy.sourceB}</dt>
          <dd>
            <span className="fr-source">{sourceLabel(sources.b)}</span>
          </dd>
        </div>
      </dl>
      <p className="fr-note">{todayCopy.questionAssumption}</p>
    </div>
  );
}

function PlanView({ plan, reason }: { plan: Plan; reason: string }) {
  const unit = plan.unit === 'minutes' ? '分' : '回';
  const amount = (n: number) => `${n.toLocaleString('ja-JP')}${unit}`;
  return (
    <div className="fr-plan">
      <p className="fr-plan__title">{todayCopy.planTitle}</p>
      <p className="fr-plan__value">{todayCopy.planSessions(plan.sessions)}</p>
      <p className="fr-note">{todayCopy.planNote(amount(plan.remainingAmount), amount(plan.sessionAmount), amount(plan.lastAmount))}</p>
      <InsufficientNotice>{reason}</InsufficientNotice>
    </div>
  );
}

/** 端に近いラベルは、図の外にはみ出さないよう寄せる向きを変える。 */
function labelAnchor(x: number, width: number, edge: number): 'start' | 'middle' | 'end' {
  if (x < edge) return 'start';
  if (x > width - edge) return 'end';
  return 'middle';
}

const AXIS_HEIGHT = 130;

function AxisChart({ today, p50Days, p80Days, sameWeek }: { today: string; p50Days: number; p80Days: number | null; sameWeek: boolean }) {
  // 実際の幅で描く（縮めて表示すると文字まで小さくなるため）
  const [ref, width] = useElementWidth<HTMLDivElement>(DEFAULT_CHART_WIDTH);
  const axis = outlookAxis(today, p50Days, p80Days, sameWeek, width);
  const description =
    p80Days === null
      ? `日付の軸。目安の日付に印。10回中8回の日付は3年以上先です。`
      : axis.sameWeek
        ? `日付の軸。目安も10回中8回の日付も同じ週です。`
        : `日付の軸。今日から目安の日付、10回中8回の日付の順に印。`;
  return (
    <div ref={ref} className="fr-chart-box">
      <svg className="fr-chart" width={width} height={AXIS_HEIGHT} viewBox={`0 0 ${width} ${AXIS_HEIGHT}`} role="img" aria-label={description}>
        <line x1={axis.axisLeft} y1="92" x2={axis.axisRight} y2="92" className="fr-chart__axis" />
        {axis.ticks.map((t) => (
          <g key={`${t.label}-${t.x}`}>
            <line x1={t.x} y1="92" x2={t.x} y2="97" className="fr-chart__axis" />
            <text x={t.x} y="112" textAnchor="middle" className="fr-chart__text">
              {t.label}
            </text>
            {t.yearLabel ? (
              <text x={t.x} y="128" textAnchor={labelAnchor(t.x, width, 24)} className="fr-chart__text">
                {t.yearLabel}
              </text>
            ) : null}
          </g>
        ))}
        <line x1={axis.axisLeft} y1="84" x2={axis.axisLeft} y2="97" className="fr-chart__today" />
        <text x={axis.axisLeft} y="112" textAnchor="start" className="fr-chart__text fr-chart__text--strong">
          今日
        </text>
        {axis.markers.map((m) => (
          <g key={m.kind}>
            <line x1={m.x} y1="62" x2={m.x} y2="92" className="fr-chart__marker-line" />
            {/* 塗り＝目安、白抜き＝10回中8回（色だけに頼らない） */}
            <circle cx={m.x} cy="58" r="7" className={m.kind === 'p50' ? 'fr-chart__dot' : 'fr-chart__dot fr-chart__dot--open'} />
            <text x={m.x} y={m.labelY} textAnchor={labelAnchor(m.x, width, 60)} className="fr-chart__text">
              {m.kind === 'p50' ? (axis.sameWeek ? '目安・10回中8回' : '目安') : '10回中8回'}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
