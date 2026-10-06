import type { Log } from '@contracts';
import { Section, SectionLabel, Help } from '../../ui/components/Section.tsx';
import { todayCopy, unitLabel } from '../../copy/today.ts';
import { useElementWidth } from '../../ui/useElementWidth.ts';
import { cumulativeChart, DEFAULT_CHART_WIDTH } from './chart-geometry.ts';

const CUMULATIVE_HEIGHT = 250;
import type { ActualProgress } from '../prior/presentation-types.ts';

interface Props {
  progress: ActualProgress;
  initialProgress: number;
  logs: Log[];
  recordStartDate: string;
  today: string;
}

/** これまでの積み上げ。％は進捗だけに使い、累計は記録開始日〜今日の範囲で描く（今日より先の線は引かない）。 */
export function ProgressSummary({ progress, initialProgress, logs, recordStartDate, today }: Props) {
  const unit = unitLabel(progress.unit);
  // 100% は達成したときだけ出す（未達で切り上げて 100% と見せない）
  const percent = Math.min(100, Math.floor((progress.done / progress.total) * 100));
  return (
    <Section labelledBy="fr-progress-title">
      <SectionLabel as="h2" id="fr-progress-title">
        {todayCopy.progressLabel}
      </SectionLabel>
      <div className="fr-progress">
        <p className="fr-progress__percent">
          {percent}
          <small>%</small>
        </p>
        <p className="fr-progress__amount">
          {progress.done.toLocaleString('ja-JP')} / {progress.total.toLocaleString('ja-JP')}
          {unit}
        </p>
      </div>
      <Help>{todayCopy.progressHelp(initialProgress, unit)}</Help>
      <CumulativeChartView logs={logs} initialProgress={initialProgress} total={progress.total} recordStartDate={recordStartDate} today={today} unit={unit} done={progress.done} />
    </Section>
  );
}

function CumulativeChartView({
  logs,
  initialProgress,
  total,
  recordStartDate,
  today,
  unit,
  done,
}: {
  logs: Log[];
  initialProgress: number;
  total: number;
  recordStartDate: string;
  today: string;
  unit: string;
  done: number;
}) {
  // 実際の幅で描く（縮めて表示すると文字まで小さくなるため）
  const [ref, width] = useElementWidth<HTMLDivElement>(DEFAULT_CHART_WIDTH);
  const c = cumulativeChart(logs, initialProgress, total, recordStartDate, today, width);
  const b = c.bounds;
  const line = c.points.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `${b.left},${c.zeroY} ${line} ${b.right},${c.zeroY}`;
  const lastPoint = c.points[c.points.length - 1];
  return (
    <div ref={ref} className="fr-chart-box">
    <svg className="fr-chart" width={width} height={CUMULATIVE_HEIGHT} viewBox={`0 0 ${width} ${CUMULATIVE_HEIGHT}`} role="img" aria-label={`記録開始日から今日までの累計。今日 ${done.toLocaleString('ja-JP')}${unit}。目標は${total.toLocaleString('ja-JP')}${unit}`}>
      <text x="50" y="16" textAnchor="end" className="fr-chart__text">
        {unit}
      </text>
      <line x1={b.left} y1={c.targetY} x2={b.right} y2={c.targetY} className="fr-chart__target" />
      <text x={b.right} y={c.targetY - 8} textAnchor="end" className="fr-chart__text">
        目標 {total.toLocaleString('ja-JP')}
        {unit}
      </text>
      {c.gridLines.map((g) => (
        <g key={g.value}>
          <line x1={b.left} y1={g.y} x2={b.right} y2={g.y} className="fr-chart__grid" />
          <text x="50" y={g.y + 4} textAnchor="end" className="fr-chart__text">
            {g.value.toLocaleString('ja-JP')}
          </text>
        </g>
      ))}
      <line x1={b.left} y1={c.zeroY} x2={b.right} y2={c.zeroY} className="fr-chart__axis" />
      <text x="50" y={c.zeroY + 4} textAnchor="end" className="fr-chart__text">
        0
      </text>
      <polygon points={area} className="fr-chart__area" />
      <polyline points={line} className="fr-chart__line" />
      {lastPoint ? <circle cx={lastPoint.x} cy={lastPoint.y} r="5" className="fr-chart__now" /> : null}
      <text x={b.left} y="218" textAnchor="start" className="fr-chart__text">
        {c.startLabel}
      </text>
      <text x={b.left} y="234" textAnchor="start" className="fr-chart__text">
        記録開始
      </text>
      <text x={b.right} y="218" textAnchor="end" className="fr-chart__text">
        {c.todayLabel}
      </text>
      <text x={b.right} y="234" textAnchor="end" className="fr-chart__text">
        今日
      </text>
    </svg>
    </div>
  );
}
