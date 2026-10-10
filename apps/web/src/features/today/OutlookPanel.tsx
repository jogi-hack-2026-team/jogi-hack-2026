import { Band } from '../../ui/components/Section.tsx';
import { InsufficientNotice } from '../../ui/components/Notice.tsx';
import type { AmountFormat } from '../../copy/amount.ts';
import { completionNoteFor, todayCopy } from '../../copy/today.ts';
import { useElementWidth } from '../../ui/useElementWidth.ts';
import { DEFAULT_CHART_WIDTH, outlookAxis } from './chart-geometry.ts';
import { shortDate, fullDate, parseLocalDate } from '../../copy/date.ts';
import { Icon } from '../../ui/components/Icon.tsx';
import { daysUntil, targetGap, targetGapText } from './target-gap.ts';
import { sourceLabel } from '../prior/PriorForecast.tsx';
import type { CompletionPresentation, Plan } from '../prior/presentation-types.ts';

/** これからの見通し（補助指標2）。目安と「10回中8回」の日付を、実際の日付に比例した軸に置く。 */
export function OutlookPanel({
  completion,
  today,
  title,
  fmt,
  targetDate = null,
}: {
  completion: CompletionPresentation;
  today: string;
  title: string;
  fmt: AmountFormat;
  /** 到達予定日（#157、B案）。設定がなければ null で、A案と同じ表示。 */
  targetDate?: string | null;
}) {
  return (
    <Band labelledBy="fr-outlook-title">
      <h2 id="fr-outlook-title" className="fr-outlook__title">
        {title}
      </h2>
      {/* 材料が足りないときも、到達予定日だけは出す（ずれは出さない） */}
      {targetDate ? <TargetDateRow targetDate={targetDate} /> : null}
      {completion.kind === 'estimate' ? (
        <Estimate completion={completion} today={today} targetDate={targetDate} />
      ) : completion.kind === 'insufficient' ? (
        <InsufficientNotice>{completion.message}</InsufficientNotice>
      ) : (
        // 材料が足りないときの、設定量で行う場合の残り（R-11、デザインキャンバス R2・R4）。日数の予測ではない
        <PlanView plan={completion.plan} reason={completion.reason} fmt={fmt} />
      )}
    </Band>
  );
}

function Estimate({ completion, today, targetDate }: { completion: Extract<CompletionPresentation, { kind: 'estimate' }>; today: string; targetDate: string | null }) {
  const label = completion.scenario === 'TODAY_DONE' ? todayCopy.completionLabelTodayDone : todayCopy.completionLabelCurrent;
  return (
    <>
      <div className="fr-outlook__estimate">
        <p className="fr-outlook__label">{label}</p>
        <p className="fr-outlook__p50">{completion.p50Label ? todayCopy.completionP50(completion.p50Label) : todayCopy.over3Years}</p>
        {targetDate ? <GapLine today={today} days={completion.p50Days} targetDate={targetDate} /> : null}
        <p className="fr-outlook__p80">{completion.p80Label ? todayCopy.completionP80(completion.p80Label) : todayCopy.completionP80Over3Years}</p>
        {targetDate ? <GapLine today={today} days={completion.p80Days} targetDate={targetDate} /> : null}
      </div>
      <EstimateNote completion={completion} />
      <SourceRows sources={completion.sources} />
      <details className="fr-today__detail" aria-label={todayCopy.outlookLabel}>
        <summary>{todayCopy.whyTitle}<Icon name="chevronDown" size={16} /></summary>
        {completion.p50Days !== null ? (
          <AxisChart today={today} p50Days={completion.p50Days} p80Days={completion.p80Days} sameWeek={completion.p50Label === completion.p80Label} targetDate={targetDate} />
        ) : null}
        <p className="fr-note">
          {completionNoteFor(completion.sources)}
          {todayCopy.axisNote}
          {targetDate ? todayCopy.targetGapNote : null}
        </p>
      </details>
    </>
  );
}

/** 到達予定日（#157、B案、デザイン B案 Today）。 */
function TargetDateRow({ targetDate }: { targetDate: string }) {
  return (
    <p className="fr-outlook__due">
      <span className="fr-outlook__due-label">
        <Icon name="flag" size={16} strokeWidth={2} />
        {todayCopy.targetDate}
      </span>
      <span className="fr-outlook__due-value">{fullDate(targetDate)}</span>
    </p>
  );
}

/** 目安・余裕をみるならの下の、到達予定日とのずれ。早い＝青緑、遅い＝琥珀。色だけでなく文字で伝える。 */
function GapLine({ today, days, targetDate }: { today: string; days: number | null; targetDate: string }) {
  const gap = targetGap(today, days, targetDate);
  if (!gap) return null;
  return (
    <p className={`fr-gap fr-gap--${gap.kind}`}>
      <Icon name="flag" size={16} strokeWidth={2} />
      <span>
        {gap.kind === 'near' ? null : todayCopy.targetGapPrefix}
        <b>{targetGapText(gap)}</b>
      </span>
    </p>
  );
}

/**
 * 日付が出ない・特別な場合の補足（デザインキャンバス D4・D4b・D8）。日数は Engine の値をそのまま見るだけで、計算しない。
 * - 目安が3年より先（p50 なし）：日付を出していない理由
 * - 10回中8回だけが3年より先（p80 なし）：その意味
 * - 今日やった場合に今週で届く（TODAY_DONE で p50 が 0 日）：今日やれば今週に届く
 */
function EstimateNote({ completion }: { completion: Extract<CompletionPresentation, { kind: 'estimate' }> }) {
  const note =
    completion.p50Days === null
      ? todayCopy.over3YearsNote
      : completion.p80Days === null
        ? todayCopy.p80Over3YearsNote
        : completion.scenario === 'TODAY_DONE' && completion.p50Days === 0
          ? todayCopy.thisWeekNote
          : null;
  return note ? <p className="fr-note">{note}</p> : null;
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

function PlanView({ plan, reason, fmt }: { plan: Plan; reason: string; fmt: AmountFormat }) {
  // 残りは累計と同じ時間＋分、1回の量と最後の量は分で書く（P-18）
  return (
    <div className="fr-plan">
      <p className="fr-plan__title">{todayCopy.planTitle}</p>
      <p className="fr-plan__value">{todayCopy.planSessions(plan.sessions)}</p>
      <p className="fr-note">{todayCopy.planNote(fmt.total(plan.remainingAmount), fmt.record(plan.sessionAmount), fmt.record(plan.lastAmount))}</p>
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

function AxisChart({ today, p50Days, p80Days, sameWeek, targetDate }: { today: string; p50Days: number; p80Days: number | null; sameWeek: boolean; targetDate: string | null }) {
  // 実際の幅で描く（縮めて表示すると文字まで小さくなるため）
  const [ref, width] = useElementWidth<HTMLDivElement>(DEFAULT_CHART_WIDTH);
  const axis = outlookAxis(today, p50Days, p80Days, sameWeek, width, targetDate ? daysUntil(today, targetDate) : null);
  const description =
    p80Days === null
      ? `日付の軸。目安の日付に印。${todayCopy.completionP80Over3Years}`
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
        {/* 到達予定日（#157、B案）。破線で示す */}
        {axis.target && targetDate ? (
          <g>
            <line x1={axis.target.x} y1="18" x2={axis.target.x} y2="92" className="fr-chart__due" />
            <text x={axis.target.x} y="12" textAnchor={labelAnchor(axis.target.x, width, 60)} className="fr-chart__text fr-chart__text--strong">
              {todayCopy.targetDateAxis(shortDate(parseLocalDate(targetDate)))}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
