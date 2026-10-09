import type { PredictionConfig, PredictionInput, PredictionResult } from './types.js';

// R-11の安定した公開契約を所有する。内部adapterのCandidate名や結果項目から導出しない。
// mappingは保存時snapshotからserverが渡し、HTTP clientのBetaを直接受け取らない。
export type QuestionPriorAnswer = 'LOW' | 'MID' | 'HIGH' | 'UNKNOWN' | null;
export type QuestionPriorAnswers = Readonly<{ a: QuestionPriorAnswer; b: QuestionPriorAnswer }>;
export interface QuestionPriorMapping {
  readonly version: string;
  readonly values: Readonly<Record<Exclude<QuestionPriorAnswer, 'UNKNOWN' | null>,
    { readonly alpha: number; readonly beta: number }>>;
}
export interface QuestionPriorPredictionInput {
  readonly prediction: PredictionInput;
  readonly answers: QuestionPriorAnswers;
  readonly mapping: QuestionPriorMapping;
}
export type QuestionPriorPredictionConfig = Omit<PredictionConfig, 'prior'>;
export type QuestionPriorEvidenceSource = 'NONE' | 'QUESTION' | 'RECORDS' | 'QUESTION_AND_RECORDS';
export type QuestionPriorPredictionResult = Omit<PredictionResult, 'config'> & {
  config: Omit<PredictionResult['config'], 'prior'>;
};
export type QuestionPriorEvaluation = {
  prediction: QuestionPriorPredictionResult;
  provenance: { a: QuestionPriorEvidenceSource; b: QuestionPriorEvidenceSource };
  plan: { remainingAmount: number; remainingSessions: number; lastSessionAmount: number } | null;
};

// 公開例外のconstructorもCandidate型へ依存させない。既存のTypeErrorと分類の構造を保つ。
export interface QuestionPriorValidationCause extends TypeError {
  readonly kind: 'input' | 'config';
  readonly reason: 'INVALID_ANSWERS' | 'INVALID_ANSWER' | 'INVALID_MAPPING';
  readonly path: readonly (string | number)[];
}
