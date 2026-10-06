// 仮APIのシナリオ。予測（prediction）は Engine の実出力（fixtures/engine-examples.json）をそのまま使い、FE では計算しない。
// シナリオは Goal の id で選ぶ（/goals/<id> を開くとそのシナリオになる）。
import type { Goal, Log, Today } from '@contracts';
import examples from './fixtures/engine-examples.json';

type EngineCase = (typeof examples.cases)[number];

export type ScenarioFailure =
  | { kind: 'network' } // 通信の失敗（fetch が失敗した場合と同じ）
  | { kind: 'http'; status: number; code: string; message: string }; // API のエラー応答

export interface Scenario {
  id: string;
  /** 開発用の一覧に出す名前（デザインキャンバスの画面名）。 */
  label: string;
  goal: Goal;
  logs: Log[];
  today: Today | null;
  /** /today の取得を失敗させる場合。 */
  todayFailure?: ScenarioFailure;
  /** Goal の取得を失敗させる場合（404 など）。 */
  goalFailure?: ScenarioFailure;
}

const cases = new Map<string, EngineCase>(examples.cases.map((c) => [c.name, c]));

function engineCase(name: string): EngineCase {
  const found = cases.get(name);
  if (!found) throw new Error(`Engine example not found: ${name}`);
  return found;
}

function scenarioId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

function previousDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

interface Options {
  label: string;
  title: string;
  unit: Goal['unit'];
  /** 記録開始日。省略時は最初の記録の日（記録がなければ今日）。 */
  recordStartDate?: string;
  todayFailure?: ScenarioFailure;
  goalFailure?: ScenarioFailure;
}

function fromEngine(index: number, name: string, o: Options): Scenario {
  const c = engineCase(name);
  const prediction = c.prediction as Today['prediction'];
  const today = prediction.today;
  const yesterday = previousDay(today);
  const logs: Log[] = c.input.logs.map((l) => ({
    localDate: l.localDate,
    status: l.status as Log['status'],
    amount: l.amount,
  }));
  const recordStartDate = o.recordStartDate ?? logs[0]?.localDate ?? today;
  const todayLog = logs.find((l) => l.localDate === today) ?? null;
  const hasYesterday = logs.some((l) => l.localDate === yesterday);
  const goal: Goal = {
    id: scenarioId(index),
    title: o.title,
    unit: o.unit,
    totalRequired: c.input.goal.totalRequired,
    sessionAmount: c.input.goal.sessionAmount,
    initialProgress: c.input.goal.initialProgress,
    timezone: 'Asia/Tokyo',
    recordStartDate,
    hasLogs: logs.length > 0,
    today,
    todayStatus: prediction.todayStatus,
  };
  return {
    id: goal.id,
    label: o.label,
    goal,
    logs,
    today: {
      today,
      yesterday,
      todayLog,
      // API と同じ定義：昨日が記録開始日以降で、昨日の記録がないときだけ true
      yesterdayMissing: yesterday >= recordStartDate && !hasYesterday,
      prediction,
    },
    ...(o.todayFailure ? { todayFailure: o.todayFailure } : {}),
    ...(o.goalFailure ? { goalFailure: o.goalFailure } : {}),
  };
}

export const scenarios: readonly Scenario[] = [
  fromEngine(1, 'fast-resumption', { label: 'D1 未記録・データ十分（再開が早い）', title: '英単語アプリ', unit: 'sessions' }),
  fromEngine(2, 'slow-resumption', { label: 'D1 再開が遅い例', title: '筋トレ', unit: 'sessions' }),
  fromEngine(3, 'unknown-gap', { label: 'D1 記録に抜けがある', title: '読書', unit: 'minutes' }),
  fromEngine(4, 'done-origin-only', { label: 'D2+D3 中心・完了とも不足', title: '資格の問題演習', unit: 'minutes' }),
  fromEngine(5, 'skip-origin-only', { label: 'D3 完了の目安だけ不足', title: 'ストレッチ', unit: 'minutes' }),
  fromEngine(6, 'available-null', { label: 'D4 目安も余裕をみた日付も3年以上先', title: '長期の目標', unit: 'minutes' }),
  fromEngine(7, 'available-zero', { label: 'D8 完了まで0日', title: 'もうすぐ届く目標', unit: 'minutes' }),
  fromEngine(8, 'today-actual', { label: 'D5 今日は記録済み（やった）', title: '読書', unit: 'minutes' }),
  fromEngine(9, 'today-skipped', { label: 'D5 今日は記録済み（休んだ）', title: '読書', unit: 'minutes' }),
  fromEngine(10, 'completed', { label: 'D6 達成済み', title: '読書', unit: 'minutes' }),
  fromEngine(11, 'empty-history', { label: 'E1 昨日が未記録', title: '英文法ドリル', unit: 'minutes', recordStartDate: '2026-10-07' }),
  fromEngine(12, 'empty-history', { label: 'E4 今日から記録を始めた', title: '英文法ドリル', unit: 'minutes' }),
  fromEngine(13, 'unknown-gap', {
    label: 'D7 通信エラー',
    title: '読書',
    unit: 'minutes',
    todayFailure: { kind: 'network' },
  }),
  fromEngine(14, 'unknown-gap', {
    label: 'D7 見込みを計算できない',
    title: '読書',
    unit: 'minutes',
    todayFailure: { kind: 'http', status: 500, code: 'PREDICTION_FAILED', message: 'Prediction could not be computed.' },
  }),
  fromEngine(15, 'unknown-gap', {
    label: 'B Goalが見つからない（404）',
    title: '読書',
    unit: 'minutes',
    goalFailure: { kind: 'http', status: 404, code: 'NOT_FOUND', message: 'Goal not found.' },
    todayFailure: { kind: 'http', status: 404, code: 'NOT_FOUND', message: 'Goal not found.' },
  }),
];

export function findScenario(goalId: string): Scenario | undefined {
  return scenarios.find((s) => s.id === goalId);
}

/** fixtures を出力したときの情報（開発用の表示に使う）。 */
export const fixtureSource = examples.source;
