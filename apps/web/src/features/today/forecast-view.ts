// /today の応答（Engine の PredictionResult そのまま）を、共通の表示データ（ForecastPresentation）へ変換する。
// 記録だけのモード用。R-11 の回答由来の出所・条件付き回数は D-26 の採択後に追加する（いまの応答には含まれない）。
//
// 守ること（PR #120 での合意）：
// - FE で数値を計算しない。日数は Engine の値をそのまま持ち、週のラベルだけを付ける。
// - 優先順は 達成済み（R-08）→ 今日記録済み（R-07）→ 未記録。
// - 不足のときは Product Spec R-06 の文言を message として渡す。Plan や回答の出所を補わない。
// - 出所は、実績から見通しを出せるときだけ RECORDS にする。不足を「実績あり」にしない。
import type { Today } from '@contracts';
import { todayCopy } from '../../copy/today.ts';
import { weekLabel } from '../../copy/date.ts';
import type { ActualProgress, CompletionPresentation, ForecastPresentation, Unit } from '../prior/presentation-types.ts';

type Prediction = Today['prediction'];

export function toForecastView(prediction: Prediction, unit: Unit): ForecastPresentation {
  const progress: ActualProgress = { done: prediction.progress.done, total: prediction.progress.total, unit };
  if (prediction.progress.completed) return { kind: 'completed', progress };

  const resumed = { success: prediction.observations.nSD, total: prediction.observations.nSD + prediction.observations.nSS };
  const completion = toCompletion(prediction);

  if (prediction.todayStatus === 'DONE' || prediction.todayStatus === 'SKIPPED') {
    if (completion.kind === 'estimate') {
      if (completion.scenario !== 'CURRENT_STATE') throw new TypeError('記録済みの日の完了の目安は CURRENT_STATE であるはずです。');
      return { kind: 'today-recorded', progress, resumed, completion: { ...completion, scenario: 'CURRENT_STATE' } };
    }
    if (completion.kind === 'insufficient') return { kind: 'today-recorded', progress, resumed, completion };
    throw new TypeError('記録済みの日に条件付きの回数は出ません。');
  }

  if (prediction.coreMetric.status === 'not_applicable') throw new TypeError('未記録の日に中心指標が対象外になっています。');
  if (completion.kind === 'estimate' && completion.scenario !== 'TODAY_DONE') {
    throw new TypeError('未記録の日の完了の目安は TODAY_DONE であるはずです。');
  }
  return {
    kind: 'forecast',
    progress,
    resumed,
    completion,
    core:
      prediction.coreMetric.status === 'available'
        ? { kind: 'estimate', days: prediction.coreMetric.g50, source: 'RECORDS' }
        : { kind: 'insufficient', message: todayCopy.insufficientCore },
  };
}

function toCompletion(prediction: Prediction): CompletionPresentation {
  const c = prediction.completion;
  switch (c.status) {
    case 'available':
      return {
        kind: 'estimate',
        scenario: c.scenario,
        sources: { a: 'RECORDS', b: 'RECORDS' },
        p50Days: c.p50Days,
        p80Days: c.p80Days,
        p50Label: weekLabel(prediction.today, c.p50Days),
        p80Label: weekLabel(prediction.today, c.p80Days),
      };
    case 'insufficient':
      return { kind: 'insufficient', message: todayCopy.insufficientCompletion };
    case 'completed':
      // 実績が未達なのに完了扱いの結果は、達成済みの判定（progress.completed）と食い違う
      throw new TypeError('未達成なのに完了の目安が completed になっています。');
  }
}
