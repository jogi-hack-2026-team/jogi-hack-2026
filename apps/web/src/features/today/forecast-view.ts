// /today の応答（Engine の PredictionResult そのまま）を、共通の表示データ（ForecastPresentation）へ変換する。
// R-11 の読み取り（?view=r11、#133）では、a／b 別の出所（provenance）と、材料が足りないときの計画（plan）も渡す。
//
// 守ること（PR #120 での合意）：
// - FE で数値を計算しない。日数は Engine の値をそのまま持ち、週のラベルだけを付ける。
// - 優先順は 達成済み（R-08）→ 今日記録済み（R-07）→ 未記録。
// - 不足のときは Product Spec R-06 の文言を message として渡す。Plan や回答の出所を補わない。
// - 出所は API の provenance をそのまま使う。provenance がない（記録だけの読み取り）ときだけ RECORDS にする。
//   見通しを出しているのに出所が NONE なら、出所を補わずに検査で止める（不足を「実績あり」や「回答あり」にしない）。
import type { TodayR11 as Today } from '@contracts';
import { todayCopy } from '../../copy/today.ts';
import { weekLabel } from '../../copy/date.ts';
import type { ActualProgress, CompletionPresentation, ForecastPresentation, Source, SufficientSource, Unit } from '../prior/presentation-types.ts';

// 実績由来の予測と R-11 の予測は config の中身だけが違う。表示に config は使わない
type Prediction = Omit<Today['prediction'], 'config'>;

/** R-11 の読み取りで得る、出所と計画。 */
export type R11Extras = { provenance: Today['provenance']; plan: Today['plan']; sessionAmount: number };

/** 見通しを出すときの出所。NONE なのに見通しが出ているのは食い違いなので止める。 */
function sufficient(source: Source): SufficientSource {
  if (source === 'NONE') throw new TypeError('見通しを表示しているのに、出所が NONE になっています。');
  return source;
}

export function toForecastView(prediction: Prediction, unit: Unit, r11?: R11Extras): ForecastPresentation {
  const progress: ActualProgress = { done: prediction.progress.done, total: prediction.progress.total, unit };
  if (prediction.progress.completed) return { kind: 'completed', progress };

  const resumed = { success: prediction.observations.nSD, total: prediction.observations.nSD + prediction.observations.nSS };
  const completion = toCompletion(prediction, unit, r11);

  if (prediction.todayStatus === 'DONE' || prediction.todayStatus === 'SKIPPED') {
    if (completion.kind === 'estimate') {
      if (completion.scenario !== 'CURRENT_STATE') throw new TypeError('記録済みの日の完了の目安は CURRENT_STATE であるはずです。');
      return { kind: 'today-recorded', progress, resumed, completion: { ...completion, scenario: 'CURRENT_STATE' } };
    }
    // 不足（計画があれば条件付きの回数）も、記録済みの日にそのまま出す
    return { kind: 'today-recorded', progress, resumed, completion };
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
        ? // 中心の数字は「休んだ日の翌日」の再開傾向から出すので、b の出所を使う
          { kind: 'estimate', days: prediction.coreMetric.g50, source: r11 ? sufficient(r11.provenance.b) : 'RECORDS' }
        : { kind: 'insufficient', message: todayCopy.insufficientCore },
  };
}

function toCompletion(prediction: Prediction, unit: Unit, r11?: R11Extras): CompletionPresentation {
  const c = prediction.completion;
  switch (c.status) {
    case 'available':
      return {
        kind: 'estimate',
        scenario: c.scenario,
        sources: r11 ? { a: sufficient(r11.provenance.a), b: sufficient(r11.provenance.b) } : { a: 'RECORDS', b: 'RECORDS' },
        p50Days: c.p50Days,
        p80Days: c.p80Days,
        p50Label: weekLabel(prediction.today, c.p50Days),
        p80Label: weekLabel(prediction.today, c.p80Days),
      };
    case 'insufficient':
      // 材料が足りないときに API が計画を返したら、設定量で行う場合の残り回数を出す（日数の予測ではない）
      if (r11?.plan) {
        return {
          kind: 'conditional',
          plan: {
            remainingAmount: r11.plan.remainingAmount,
            sessions: r11.plan.remainingSessions,
            sessionAmount: r11.sessionAmount,
            lastAmount: r11.plan.lastSessionAmount,
            unit,
          },
          reason: todayCopy.planReason(r11.provenance.a === 'NONE', r11.provenance.b === 'NONE'),
        };
      }
      return { kind: 'insufficient', message: todayCopy.insufficientCompletion };
    case 'completed':
      // 実績が未達なのに完了扱いの結果は、達成済みの判定（progress.completed）と食い違う
      throw new TypeError('未達成なのに完了の目安が completed になっています。');
  }
}
