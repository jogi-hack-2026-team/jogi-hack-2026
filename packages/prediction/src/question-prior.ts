import { DEFAULT_CONFIG } from './config.js';
import { evaluateQuestionPriorAdapterCandidate, QuestionPriorAdapterCandidateError } from './question-prior-adapter-candidate.js';
import type { QuestionPriorAdapterInputCandidate, EvidenceSourceCandidate } from './question-prior-adapter-candidate.js';
import type { PredictionConfig, PredictionResult } from './types.js';

// #133: 依頼者承認されたR-11の公開境界。数値核と旧predictはそのまま使う。
// mappingは保存時snapshotからserverが渡す。HTTP clientからBetaを受け取らない。
export type QuestionPriorAnswer = 'LOW' | 'MID' | 'HIGH' | 'UNKNOWN' | null;
export type QuestionPriorAnswers = Readonly<{ a: QuestionPriorAnswer; b: QuestionPriorAnswer }>;
export type QuestionPriorMapping = QuestionPriorAdapterInputCandidate['mapping'];
export type QuestionPriorPredictionInput = QuestionPriorAdapterInputCandidate;
export type QuestionPriorPredictionConfig = Omit<PredictionConfig, 'prior'>;
export type QuestionPriorEvidenceSource = EvidenceSourceCandidate;
export type QuestionPriorPredictionResult = Omit<PredictionResult, 'config'> & {
  config: Omit<PredictionResult['config'], 'prior'>;
};
export type QuestionPriorEvaluation = {
  prediction: QuestionPriorPredictionResult;
  provenance: { a: QuestionPriorEvidenceSource; b: QuestionPriorEvidenceSource };
  plan: { remainingAmount: number; remainingSessions: number; lastSessionAmount: number } | null;
};

export class QuestionPriorError extends TypeError {
  readonly kind: 'input' | 'config';
  readonly reason: string;
  readonly path: readonly (string | number)[];
  constructor(cause: QuestionPriorAdapterCandidateError) {
    super('Invalid question prior');
    this.name = 'QuestionPriorError';
    this.kind = cause.kind;
    this.reason = cause.reason;
    this.path = cause.path;
  }
}

export function predictWithQuestionPrior(input: QuestionPriorPredictionInput,
  config: QuestionPriorPredictionConfig = DEFAULT_CONFIG): QuestionPriorEvaluation {
  try {
    // adapterは両方の材料がある場合も完了予測を二重に計算しない。
    const result = evaluateQuestionPriorAdapterCandidate(input, config);
    const { rawAnswers: _raw, mappingVersion: _mapping, evidenceSource, eligible: _eligible,
      conditionalPlan, priorSnapshot: _prior, ...calculation } = result;
    const prediction = { ...calculation, modelVersion: 'm1-question-prior-v1' };
    return { prediction, provenance: evidenceSource,
      plan: !prediction.progress.completed && prediction.completion.status === 'insufficient' ? conditionalPlan : null };
  } catch (error) {
    if (error instanceof QuestionPriorAdapterCandidateError) throw new QuestionPriorError(error);
    throw error;
  }
}
