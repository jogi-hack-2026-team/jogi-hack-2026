import { predict, PredictionInputError, PredictionConfigError } from '../src/index.js';
import type { CoreMetric, LocalDate, PredictionInput, Completion, PredictionCalculation, PredictionResult } from '../src/index.js';

const callerDate: LocalDate = '2026-10-03';
const input: PredictionInput = {
  goal: { totalRequired: 20, initialProgress: 2, sessionAmount: 10 },
  logs: [{ localDate: callerDate, status: 'SKIPPED', amount: null }],
  today: callerDate,
};
void input;

function waitingDays(metric: CoreMetric): number | undefined {
  switch (metric.status) {
    case 'available': return metric.g50;
    case 'insufficient':
    case 'not_applicable': return undefined;
  }
}
void waitingDays;

// @ts-expect-error 計算できない指標に数値の待ち日数を持たせない。
const unavailableWithDelay: CoreMetric = { status: 'insufficient', reason: 'NO_SKIP_ORIGIN_TRANSITION', g50: 0 };
// @ts-expect-error UNKNOWNは記録のない暦日であり、保存するActionLogのstatusではない。
const unknownLog: PredictionInput['logs'][number] = { localDate: callerDate, status: 'UNKNOWN', amount: null };
// @ts-expect-error reasonは状態を区別するstatusと一致しなければならない。
const wrongReason: CoreMetric = { status: 'not_applicable', reason: 'NO_SKIP_ORIGIN_TRANSITION' };
void unavailableWithDelay;
void unknownLog;
void wrongReason;

const partialHorizon: Completion = { status: 'available', scenario: 'CURRENT_STATE', p50Days: 1, p80Days: null };
// @ts-expect-error 上限日数内で分位点へ届かなければnullにし、特別な文字列で代用しない。
const badTail: Completion = { status: 'available', scenario: 'TODAY_DONE', p50Days: 'unreachable', p80Days: null };
// @ts-expect-error 達成済みの結果に、未達成向けの完了日数見込みを持たせない。
const completedWithDays: Completion = { status: 'completed', p50Days: 0 };
function pendingMetadata(result: PredictionCalculation): void {
  // @ts-expect-error 内部計算だけの型には、Resultに必須の日数metadataがない。
  void result.observations.observedDays;
  // @ts-expect-error 内部計算の型には、採択済みの必須metadata2項目がない。
  const incomplete: PredictionResult = result;
  // 不完全な数値計算用の型を、完全なResultとして渡せない。
  const complete: PredictionResult = { ...result,
    observations: { ...result.observations, observedDays: 1, recordedDays: 1 } };
  void incomplete;
  void complete;
}
void partialHorizon;
void badTail;
void completedWithDays;
void pendingMetadata;

const publicResult: PredictionResult = predict(input);
const publicCalendarDays: number = publicResult.observations.observedDays;
const publicRecordedDays: number = publicResult.observations.recordedDays;
function classifiedError(error: unknown): readonly (string | number)[] | undefined {
  if (error instanceof PredictionInputError || error instanceof PredictionConfigError) {
    // @ts-expect-error 利用側からpathを書き換えられない。
    error.path.push('changed');
    return error.path;
  }
  return undefined;
}
void publicCalendarDays;
void publicRecordedDays;
void classifiedError;
