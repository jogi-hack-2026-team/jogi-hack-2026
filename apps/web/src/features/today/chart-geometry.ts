// 図の座標だけを計算する（予測の数値は計算しない。Engine の日数と保存済みの記録をそのまま位置に変えるだけ）。
// 座標は実際の表示幅（px）で計算する。viewBox で縮めると文字まで小さくなるため。
import type { Log } from '@contracts';
import { addDays, daysBetween, parseLocalDate, shortDate } from '../../copy/date.ts';

/** 幅を測れるまでの仮の幅（デザインの基準幅）。 */
export const DEFAULT_CHART_WIDTH = 350;

// ---- これからの見通し：今日から余裕をみた日付までを、実際の日付に比例した軸に置く（デザイン案5） ----

export interface AxisMarker {
  x: number;
  kind: 'p50' | 'p80';
  /** ラベルの縦位置。近い2つの印はラベルをずらして重ならないようにする。 */
  labelY: number;
}
export interface AxisTick {
  x: number;
  label: string;
  yearLabel: string | null;
}
export interface OutlookAxis {
  markers: AxisMarker[];
  ticks: AxisTick[];
  /** 目安と「10回中8回」が同じ週か（同じ週なら印を1つにまとめる）。 */
  sameWeek: boolean;
  axisLeft: number;
  axisRight: number;
  /** 到達予定日の位置（#157、B案）。設定がない・今日以前なら null。 */
  target: { x: number } | null;
}

/** 印のラベル同士が重なる横の距離（px）。 */
const LABEL_GAP = 56;
/** 目盛りのラベル（「12月」など）同士、また「今日」との間に必要な横の距離（px）。 */
const TICK_GAP = 34;

/** 目盛りの間隔の候補（か月）。 */
const MONTH_STEPS = [1, 2, 3, 6, 12] as const;

const AXIS_LEFT = 20;
const AXIS_RIGHT_PAD = 16;

export function outlookAxis(today: string, p50Days: number, p80Days: number | null, sameWeek: boolean, width: number, targetDays: number | null = null): OutlookAxis {
  const axisRight = width - AXIS_RIGHT_PAD;
  // 到達予定日が見通しより先なら、軸をそこまで伸ばす
  const target = targetDays !== null && targetDays > 0 ? targetDays : null;
  const last = Math.max(p80Days ?? p50Days, target ?? 0);
  // 右端に少し余白を取り、短い期間でも3週間分は見せる
  const span = Math.max(21, Math.ceil(last * 1.15) + 7);
  const x = (days: number) => AXIS_LEFT + ((axisRight - AXIS_LEFT) * days) / span;

  const markers: AxisMarker[] = [{ x: x(p50Days), kind: 'p50', labelY: 38 }];
  if (p80Days !== null && !sameWeek) {
    const p80x = x(p80Days);
    const close = p80x - x(p50Days) < LABEL_GAP;
    markers.push({ x: p80x, kind: 'p80', labelY: close ? 20 : 38 });
  }

  // 月の初日に目盛りを置く。間隔は 1・2・3・6・12か月から、ラベルが重ならない一番細かいものを選び、
  // 暦にそろえる（3か月おきなら1・4・7・10月）。「今日」に近すぎる目盛りは出さない
  const start = parseLocalDate(today);
  const pxPerMonth = ((axisRight - AXIS_LEFT) * 30.44) / span;
  const step = MONTH_STEPS.find((s) => s * pxPerMonth >= TICK_GAP) ?? 12;
  const ticks: AxisTick[] = [];
  let lastYear = start.getUTCFullYear();
  for (let i = 1; ; i += 1) {
    const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const days = Math.round((first.getTime() - start.getTime()) / 86_400_000);
    if (days > span) break;
    if (first.getUTCMonth() % step !== 0) continue;
    const tickX = x(days);
    if (tickX - AXIS_LEFT < TICK_GAP) continue;
    const year = first.getUTCFullYear();
    ticks.push({ x: tickX, label: `${first.getUTCMonth() + 1}月`, yearLabel: year !== lastYear ? `${year}年` : null });
    lastYear = year;
  }
  return { markers, ticks, sameWeek, axisLeft: AXIS_LEFT, axisRight, target: target === null ? null : { x: x(target) } };
}

// ---- これまでの積み上げ：記録開始日から今日までの累計（初期量＋DONE の量） ----

export interface PlotBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface CumulativeChart {
  points: { x: number; y: number }[];
  targetY: number;
  zeroY: number;
  gridLines: { y: number; value: number }[];
  startLabel: string;
  todayLabel: string;
  last: number;
  bounds: PlotBounds;
}

const PLOT_LEFT = 56;
const PLOT_RIGHT_PAD = 14;
const PLOT_TOP = 30;
const PLOT_BOTTOM = 200;

export function cumulativeChart(
  logs: Log[],
  initialProgress: number,
  total: number,
  recordStartDate: string,
  today: string,
  width: number,
  /** 目盛りの値をそろえる刻み（分のGoalは60分＝1時間刻みにして、目盛りを整数の時間にする。P-18）。 */
  gridUnit = 1,
): CumulativeChart {
  const bounds: PlotBounds = { left: PLOT_LEFT, right: width - PLOT_RIGHT_PAD, top: PLOT_TOP, bottom: PLOT_BOTTOM };
  const days = Math.max(1, daysBetween(recordStartDate, today));
  const doneByDate = new Map(logs.filter((l) => l.status === 'DONE').map((l) => [l.localDate, l.amount ?? 0]));
  const y = (value: number) => bounds.bottom - ((bounds.bottom - bounds.top) * Math.min(value, total)) / total;
  const xAt = (d: number) => bounds.left + ((bounds.right - bounds.left) * d) / days;

  const points: { x: number; y: number }[] = [];
  let sum = initialProgress;
  for (let d = 0; d <= days; d += 1) {
    const date = addDays(recordStartDate, d).toISOString().slice(0, 10);
    sum += doneByDate.get(date) ?? 0;
    points.push({ x: xAt(d), y: y(sum) });
  }
  const gridLines = [1 / 3, 2 / 3].map((r) => {
    const value = Math.round((total * r) / gridUnit) * gridUnit;
    return { y: y(value), value };
  });
  return {
    points,
    targetY: y(total),
    zeroY: bounds.bottom,
    gridLines,
    startLabel: shortDate(parseLocalDate(recordStartDate)),
    todayLabel: shortDate(parseLocalDate(today)),
    last: sum,
    bounds,
  };
}
