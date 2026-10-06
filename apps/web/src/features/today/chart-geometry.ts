// 図の座標だけを計算する（予測の数値は計算しない。Engine の日数と保存済みの記録をそのまま位置に変えるだけ）。
import type { Log } from '@contracts';
import { addDays, daysBetween, parseLocalDate, shortDate } from '../../copy/date.ts';

export const CHART_WIDTH = 350;

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
}

/** ラベル同士が重なる横の距離（px）。 */
const LABEL_GAP = 56;

const AXIS_LEFT = 20;
const AXIS_RIGHT = 334;

export function outlookAxis(today: string, p50Days: number, p80Days: number | null, sameWeek: boolean): OutlookAxis {
  const last = p80Days ?? p50Days;
  // 右端に少し余白を取り、短い期間でも3週間分は見せる
  const span = Math.max(21, Math.ceil(last * 1.15) + 7);
  const x = (days: number) => AXIS_LEFT + ((AXIS_RIGHT - AXIS_LEFT) * days) / span;

  const markers: AxisMarker[] = [{ x: x(p50Days), kind: 'p50', labelY: 38 }];
  if (p80Days !== null && !sameWeek) {
    const p80x = x(p80Days);
    const close = p80x - x(p50Days) < LABEL_GAP;
    markers.push({ x: p80x, kind: 'p80', labelY: close ? 20 : 38 });
  }

  // 月の初日に目盛りを置く。期間が長いときは間引いて、ラベルが重ならないようにする
  const start = parseLocalDate(today);
  const ticks: AxisTick[] = [];
  const monthCount = Math.ceil(span / 30) + 1;
  const step = monthCount > 8 ? Math.ceil(monthCount / 8) : 1;
  let lastYear = start.getUTCFullYear();
  for (let i = 1; i <= monthCount; i += step) {
    const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const days = Math.round((first.getTime() - start.getTime()) / 86_400_000);
    if (days > span) break;
    const year = first.getUTCFullYear();
    ticks.push({ x: x(days), label: `${first.getUTCMonth() + 1}月`, yearLabel: year !== lastYear ? `${year}年` : null });
    lastYear = year;
  }
  return { markers, ticks, sameWeek };
}

// ---- これまでの積み上げ：記録開始日から今日までの累計（初期量＋DONE の量） ----

export interface CumulativeChart {
  points: { x: number; y: number }[];
  targetY: number;
  zeroY: number;
  gridLines: { y: number; value: number }[];
  startLabel: string;
  todayLabel: string;
  last: number;
}

const PLOT_LEFT = 56;
const PLOT_RIGHT = 336;
const PLOT_TOP = 30;
const PLOT_BOTTOM = 200;

export function cumulativeChart(logs: Log[], initialProgress: number, total: number, recordStartDate: string, today: string): CumulativeChart {
  const days = Math.max(1, daysBetween(recordStartDate, today));
  const doneByDate = new Map(logs.filter((l) => l.status === 'DONE').map((l) => [l.localDate, l.amount ?? 0]));
  const y = (value: number) => PLOT_BOTTOM - ((PLOT_BOTTOM - PLOT_TOP) * Math.min(value, total)) / total;
  const xAt = (d: number) => PLOT_LEFT + ((PLOT_RIGHT - PLOT_LEFT) * d) / days;

  const points: { x: number; y: number }[] = [];
  let sum = initialProgress;
  for (let d = 0; d <= days; d += 1) {
    const date = addDays(recordStartDate, d).toISOString().slice(0, 10);
    sum += doneByDate.get(date) ?? 0;
    points.push({ x: xAt(d), y: y(sum) });
  }
  const gridLines = [1 / 3, 2 / 3].map((r) => {
    const value = Math.round(total * r);
    return { y: y(value), value };
  });
  return {
    points,
    targetY: y(total),
    zeroY: PLOT_BOTTOM,
    gridLines,
    startLabel: shortDate(parseLocalDate(recordStartDate)),
    todayLabel: shortDate(parseLocalDate(today)),
    last: sum,
  };
}

export const plotBounds = { left: PLOT_LEFT, right: PLOT_RIGHT, top: PLOT_TOP, bottom: PLOT_BOTTOM };
