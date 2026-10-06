import { PredictionConfigError, PredictionInputError, predict, type PredictionInput, type PredictionResult } from '@futureroi/prediction';
import type { Static } from '@sinclair/typebox';
import type { PredictionResultSchema } from '../contracts/log.ts';

// Engine（packages/prediction、純粋関数）との境界。DB・HTTP・時計はここに持ち込まない。
// 実行方式（同期か同一プロセス内worker）は#84の計測を受けて判断する残件で、MVPは同期で呼ぶ。
// 呼び出しをこの関数に閉じ込め、workerへ移す場合もroute側を変えずに済むようにする。

type SchemaResult = Static<typeof PredictionResultSchema>;
// 契約のschemaとEngineの型の双方向の互換を型検査する。どちらかに項目が増減するとここが型エラーになる。
export const predictionResultSchemaMatchesEngine: [SchemaResult extends PredictionResult ? true : false, PredictionResult extends SchemaResult ? true : false] = [true, true];

export class PredictionFailed extends Error {
  readonly reason: string;
  readonly path: readonly (string | number)[];
  constructor(cause: PredictionInputError | PredictionConfigError) {
    super(`prediction failed: ${cause.name} ${cause.reason}`);
    this.name = 'PredictionFailed';
    this.reason = cause.reason;
    this.path = cause.path;
  }
}

export function runPrediction(input: PredictionInput): PredictionResult {
  try {
    return predict(input);
  } catch (error) {
    // 保存済みデータから組み立てた入力の不正（未来日付・重複等）は利用者が直せないため、原因を記録して500にする。
    if (error instanceof PredictionInputError || error instanceof PredictionConfigError) throw new PredictionFailed(error);
    throw error;
  }
}
