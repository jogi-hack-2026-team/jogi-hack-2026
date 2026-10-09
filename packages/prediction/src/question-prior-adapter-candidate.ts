import { DEFAULT_CONFIG } from './config.js';
import { PredictionConfigError } from './errors.js';
import { evaluateGoalPriorCandidate } from './goal-prior-candidate.js';
import type { GoalPriorCandidate, GoalPriorCandidateConfig, GoalPriorCandidateResult } from './goal-prior-candidate.js';
import { recoveryQuantiles } from './recovery.js';
import { completionFromValidatedState } from './completion-scenario.js';
import type { Completion, PredictionInput } from './types.js';

// Candidateという名前はPR118の候補接続として追加した経緯を残している。現在は
// question-prior.tsの公開wrapper predictWithQuestionPrior（#133 / D-26）がここを使う。
// このadapter自体はindex.tsから直接公開せず、旧predictの共通prior・材料条件も変えない。
// 候補全体の採択や予測精度の検証済みを名前から判断せず、承認範囲はD-26を参照する。
export type NumericAnswerCandidate = 'LOW' | 'MID' | 'HIGH';
export type RawAnswerCandidate = NumericAnswerCandidate | 'UNKNOWN' | null;
export type EvidenceSourceCandidate = 'NONE' | 'QUESTION' | 'RECORDS' | 'QUESTION_AND_RECORDS';
export interface QuestionPriorMappingCandidate {
  readonly version: string;
  readonly values: Readonly<Record<NumericAnswerCandidate, { readonly alpha: number; readonly beta: number }>>;
}
export interface QuestionPriorAdapterInputCandidate {
  readonly prediction: PredictionInput;
  readonly answers: { readonly a: RawAnswerCandidate; readonly b: RawAnswerCandidate };
  readonly mapping: QuestionPriorMappingCandidate;
}
export interface QuestionPriorAdapterResultCandidate extends GoalPriorCandidateResult {
  readonly rawAnswers: QuestionPriorAdapterInputCandidate['answers'];
  readonly mappingVersion: string;
  readonly evidenceSource: { readonly a: EvidenceSourceCandidate; readonly b: EvidenceSourceCandidate };
  readonly eligible: { readonly a: boolean; readonly b: boolean };
  readonly conditionalPlan: {
    readonly remainingAmount: number;
    readonly remainingSessions: number;
    readonly lastSessionAmount: number;
  };
}

// raw/snapshotの構造不正をmessage解析なしで区別する内部分類。公開wrapperは
// QuestionPriorErrorへ変換してkind/reason/pathを渡し、HTTPコードはAPI側で決める。
export class QuestionPriorAdapterCandidateError extends TypeError {
  readonly kind: 'input' | 'config';
  readonly reason: 'INVALID_ANSWERS' | 'INVALID_ANSWER' | 'INVALID_MAPPING';
  readonly path: readonly (string | number)[];
  constructor(kind: 'input' | 'config', reason: QuestionPriorAdapterCandidateError['reason'],
    path: readonly (string | number)[]) {
    super(`Invalid question-prior candidate ${kind}`);
    this.name = 'QuestionPriorAdapterCandidateError';
    this.kind = kind; this.reason = reason; this.path = Object.freeze([...path]);
  }
}

function resolve(input: QuestionPriorAdapterInputCandidate): {
  prior: GoalPriorCandidate; numeric: { a: boolean; b: boolean }; answers: QuestionPriorAdapterInputCandidate['answers'];
} {
  if (!input || typeof input !== 'object' || !input.answers || typeof input.answers !== 'object' || Array.isArray(input.answers)) {
    throw new QuestionPriorAdapterCandidateError('input', 'INVALID_ANSWERS', ['answers']);
  }
  const answers = input.answers;
  for (const name of ['a', 'b'] as const) {
    if (!Object.hasOwn(answers, name) || ![null, 'UNKNOWN', 'LOW', 'MID', 'HIGH'].includes(answers[name])) {
      throw new QuestionPriorAdapterCandidateError('input', 'INVALID_ANSWER', ['answers', name]);
    }
  }
  const mapping = input.mapping;
  if (!mapping || typeof mapping !== 'object' || typeof mapping.version !== 'string' || !mapping.version.trim() ||
    !mapping.values || typeof mapping.values !== 'object') {
    throw new QuestionPriorAdapterCandidateError('config', 'INVALID_MAPPING', ['mapping']);
  }
  for (const answer of ['LOW', 'MID', 'HIGH'] as const) {
    const value = mapping.values[answer];
    if (!Object.hasOwn(mapping.values, answer) || !value || typeof value !== 'object') {
      throw new QuestionPriorAdapterCandidateError('config', 'INVALID_MAPPING', ['mapping', 'values', answer]);
    }
    for (const shape of ['alpha', 'beta'] as const) {
      // 保存mappingの破損を未回答fallbackに変換しない。既存整数/Gammaの計算境界を守る。
      if (!Number.isSafeInteger(value[shape]) || value[shape] < 1) {
        throw new PredictionConfigError('INVALID_INTEGER', ['mapping', 'values', answer, shape],
          'Candidate prior shape must be a positive safe integer');
      }
    }
  }
  const make = (name: 'a' | 'b') => {
    const answer = answers[name];
    const numeric = answer !== null && answer !== 'UNKNOWN';
    return { numeric, value: { ...(numeric ? mapping.values[answer] : { alpha: DEFAULT_CONFIG.prior, beta: DEFAULT_CONFIG.prior }),
      source: numeric ? `PR118:${answer}` : 'internal-common-fallback',
      version: numeric ? mapping.version : DEFAULT_CONFIG.modelVersion } };
  };
  const a = make('a'), b = make('b');
  return { prior: { a: a.value, b: b.value }, numeric: { a: a.numeric, b: b.numeric },
    answers: { a: answers.a, b: answers.b } };
}

export function evaluateQuestionPriorAdapterCandidate(input: QuestionPriorAdapterInputCandidate,
  config: GoalPriorCandidateConfig = DEFAULT_CONFIG): QuestionPriorAdapterResultCandidate {
  const { prior, numeric, answers } = resolve(input);
  const baseline = evaluateGoalPriorCandidate(input.prediction, prior, config);
  const origin = { a: baseline.observations.nDD + baseline.observations.nDS,
    b: baseline.observations.nSD + baseline.observations.nSS };
  const source = (name: 'a' | 'b'): EvidenceSourceCandidate => numeric[name]
    ? (origin[name] > 0 ? 'QUESTION_AND_RECORDS' : 'QUESTION') : (origin[name] > 0 ? 'RECORDS' : 'NONE');
  const evidenceSource = { a: source('a'), b: source('b') };
  const eligible = { a: evidenceSource.a !== 'NONE', b: evidenceSource.b !== 'NONE' };
  let coreMetric = baseline.coreMetric;
  // 達成・今日記録済みを先に保持する。MIDとfallbackの同じ数値から材料の有無を推定しない。
  if (!baseline.progress.completed && baseline.todayStatus === 'UNRECORDED' && eligible.b && coreMetric.status !== 'available') {
    coreMetric = { status: 'available', ...recoveryQuantiles(baseline.posterior.b.alpha, baseline.posterior.b.beta) };
  }
  let completion: Completion;
  if (baseline.progress.completed) completion = { status: 'completed' };
  else if (!eligible.a) completion = { status: 'insufficient', reason: 'NO_DONE_ORIGIN_TRANSITION' };
  else if (!eligible.b) completion = { status: 'insufficient', reason: 'NO_SKIP_ORIGIN_TRANSITION' };
  else if (baseline.completion.status === 'available') completion = baseline.completion;
  else completion = completionFromValidatedState(input.prediction.goal, baseline.progress.done,
    baseline.todayStatus, baseline.posterior, config);
  // 設定量で続ける場合の回数であり予測日数ではない。今日の仮実行を実績から引かない。
  const remainingAmount = Math.max(0, input.prediction.goal.totalRequired - baseline.progress.done);
  const remaining = BigInt(remainingAmount), amount = BigInt(input.prediction.goal.sessionAmount);
  const sessions = (remaining + amount - 1n) / amount;
  const conditionalPlan = { remainingAmount, remainingSessions: Number(sessions),
    lastSessionAmount: sessions === 0n ? 0 : Number(remaining - (sessions - 1n) * amount) };
  return { ...baseline, rawAnswers: answers, mappingVersion: input.mapping.version, evidenceSource, eligible,
    coreMetric, completion, conditionalPlan };
}
