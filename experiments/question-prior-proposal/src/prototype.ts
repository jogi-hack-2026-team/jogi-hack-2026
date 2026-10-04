// Supporting Artifact / Not a Source of Truth. No DB, HTTP or production imports.
import { completionPmf, drawsFromPosterior, quantileDays } from '../reference/completion-dp.mjs';

export type Answer = 'often' | 'sometimes' | 'rarely' | 'unknown' | 'unanswered';
export type Experience = 'same_action' | 'new_action' | 'unknown';
export type Shape = readonly [number, number];
export type Answers = Readonly<{ experience: Experience; afterDone: Answer; afterSkip: Answer }>;
export type Goal = Readonly<{
  totalRequired: number; sessionAmount: number; initialProgress: number;
  frequency: 'daily' | 'non_daily'; actionSpec: string;
}>;
export type Log = Readonly<{
  localDate: string; status: 'DONE' | 'SKIPPED'; amount: number | null;
}>;
export type Counts = Readonly<{ dd: number; ds: number; sd: number; ss: number }>;
export type InitialPrior = Readonly<{
  schemaVersion: 1; mappingVersion: 'same-action-s4-v1'; revision: number;
  actionSpec: string; answers: Answers; a: Shape; b: Shape;
  sourceA: 'questionnaire' | 'common'; sourceB: 'questionnaire' | 'common';
}>;
export type Plan = Readonly<{
  status: 'conditional_plan'; remainingSessions: number; daysFromToday: number;
  assumption: 'FROM_TODAY_DAILY_ONE_SESSION' | 'FROM_TOMORROW_DAILY_ONE_SESSION';
}>;
export type Provenance = Readonly<{
  initialSource: 'questionnaire' | 'common'; observations: number;
  label: 'QUESTIONNAIRE_ONLY' | 'COMMON_ONLY' | 'OBSERVED_PLUS_QUESTIONNAIRE' | 'OBSERVED_PLUS_COMMON';
  priorWeight: number;
}>;
type Core = { status: 'available'; g50: number; g80: number; basis: Provenance }
  | { status: 'insufficient'; reason: 'NO_SKIP_ORIGIN_TRANSITION' }
  | { status: 'conditional_plan'; reason: 'NO_SKIP_BASIS' }
  | { status: 'not_applicable'; reason: 'COMPLETED' | 'TODAY_RECORDED' | 'NON_DAILY' };
type Completion = { status: 'available'; p50Days: number | null; p80Days: number | null;
  scenario: 'TODAY_DONE' | 'CURRENT_STATE'; basisA: Provenance; basisB: Provenance }
  | { status: 'insufficient'; reason: 'NO_DONE_ORIGIN_TRANSITION' | 'NO_SKIP_ORIGIN_TRANSITION' }
  | { status: 'conditional_plan'; reason: 'MISSING_ORIGIN_BASIS' }
  | { status: 'completed' } | { status: 'not_applicable'; reason: 'NON_DAILY' };
export type Result = Readonly<{
  counts: Counts; actualDone: number; projectedDone: number; requiredFutureDone: number;
  todayStatus: 'DONE' | 'SKIPPED' | 'UNRECORDED'; posterior: { a: Shape; b: Shape };
  provenance: { a: Provenance; b: Provenance }; core: Core; completion: Completion;
  plan: Plan | null; diagnostics: readonly string[];
}>;
const candidates: Readonly<Record<'often' | 'sometimes' | 'rarely', Shape>> = {
  often: [3, 1], sometimes: [2, 2], rarely: [1, 3],
};
const known = (answer: Answer): answer is keyof typeof candidates => answer in candidates;
const integer = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n);
function shape(s: Shape): void {
  if (!Array.isArray(s) || s.length !== 2 || !s.every(n => integer(n) && n >= 1)) throw Error('INVALID_SHAPE');
}
function validAnswers(a: Answers): void {
  if (!a || !['same_action', 'new_action', 'unknown'].includes(a.experience)
    || !['often', 'sometimes', 'rarely', 'unknown', 'unanswered'].includes(a.afterDone)
    || !['often', 'sometimes', 'rarely', 'unknown', 'unanswered'].includes(a.afterSkip)) throw Error('INVALID_ANSWERS');
}
export function makeInitialPrior(answers: Answers, actionSpec: string, revision = 1): InitialPrior {
  validAnswers(answers);
  if (typeof actionSpec !== 'string' || !actionSpec.trim() || !integer(revision) || revision < 1) throw Error('INVALID_SNAPSHOT_CONTEXT');
  const eligible = answers.experience === 'same_action';
  const sourceA = eligible && known(answers.afterDone) ? 'questionnaire' : 'common';
  const sourceB = eligible && known(answers.afterSkip) ? 'questionnaire' : 'common';
  return {
    schemaVersion: 1, mappingVersion: 'same-action-s4-v1', revision, actionSpec, answers: { ...answers },
    a: sourceA === 'questionnaire' && known(answers.afterDone) ? [...candidates[answers.afterDone]] : [2, 2],
    b: sourceB === 'questionnaire' && known(answers.afterSkip) ? [...candidates[answers.afterSkip]] : [2, 2], sourceA, sourceB,
  };
}
export function validateInitialPrior(prior: InitialPrior, actionSpec: string): void {
  if (!prior || prior.schemaVersion !== 1 || prior.mappingVersion !== 'same-action-s4-v1') throw Error('UNSUPPORTED_PRIOR_VERSION');
  if (prior.actionSpec !== actionSpec) throw Error('ACTION_SPEC_MISMATCH');
  shape(prior.a); shape(prior.b);
  const expected = makeInitialPrior(prior.answers, prior.actionSpec, prior.revision);
  if (prior.sourceA !== expected.sourceA || prior.sourceB !== expected.sourceB
    || prior.a.some((n, i) => n !== expected.a[i]) || prior.b.some((n, i) => n !== expected.b[i])) throw Error('PRIOR_SNAPSHOT_MISMATCH');
}
function day(date: string): number {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error('INVALID_DATE');
  const ms = Date.parse(date + 'T00:00:00Z');
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date) throw Error('INVALID_DATE');
  return ms / 86400000;
}
export function rebuildRaw(logs: readonly Log[], today: string, goal: Goal): {
  counts: Counts; actualDone: number; todayStatus: Result['todayStatus'];
} {
  const now = day(today);
  if (!goal || !integer(goal.totalRequired) || goal.totalRequired <= 0 || !integer(goal.sessionAmount) || goal.sessionAmount <= 0
    || !integer(goal.initialProgress) || goal.initialProgress < 0
    || !['daily', 'non_daily'].includes(goal.frequency) || typeof goal.actionSpec !== 'string' || !goal.actionSpec.trim()) throw Error('INVALID_GOAL');
  if (!Array.isArray(logs)) throw Error('INVALID_LOGS');
  const sorted = [...logs].sort((a, b) => day(a.localDate) - day(b.localDate));
  const c = { dd: 0, ds: 0, sd: 0, ss: 0 }; let actualDone = goal.initialProgress;
  let previousDay: number | null = null; let previousStatus: Log['status'] | null = null;
  let todayStatus: Result['todayStatus'] = 'UNRECORDED';
  for (const log of sorted) {
    const currentDay = day(log.localDate);
    if (currentDay > now) throw Error('FUTURE_DATE');
    if (currentDay === previousDay) throw Error('DUPLICATE_DATE');
    if (log.status === 'DONE') {
      if (!integer(log.amount) || log.amount <= 0) throw Error('INVALID_DONE_AMOUNT');
      actualDone += log.amount;
      if (!integer(actualDone)) throw Error('AMOUNT_OVERFLOW');
    } else if (log.status !== 'SKIPPED' || log.amount !== null) throw Error('INVALID_SKIP_LOG');
    if (previousDay !== null && currentDay - previousDay === 1) {
      const key = (previousStatus === 'DONE' ? (log.status === 'DONE' ? 'dd' : 'ds') : (log.status === 'DONE' ? 'sd' : 'ss'));
      c[key]++;
    }
    if (currentDay === now) todayStatus = log.status;
    previousDay = currentDay; previousStatus = log.status;
  }
  return { counts: c, actualDone, todayStatus };
}
export function posteriorFromRaw(prior: { a: Shape; b: Shape }, c: Counts): { a: Shape; b: Shape } {
  shape(prior.a); shape(prior.b);
  if (!c || ![c.dd, c.ds, c.sd, c.ss].every(n => integer(n) && n >= 0)) throw Error('INVALID_COUNTS');
  const a: Shape = [prior.a[0] + c.dd, prior.a[1] + c.ds];
  const b: Shape = [prior.b[0] + c.sd, prior.b[1] + c.ss]; shape(a); shape(b);
  return { a, b };
}
// Exact threshold comparison: alpha,beta >=1 safe integers, no floating-point CDF.
export function betaGeometricQuantile(s: Shape, q: 50 | 80, maxDays = 100000): number | null {
  shape(s);
  if (![50, 80].includes(q) || !integer(maxDays) || maxDays < 1) throw Error('INVALID_QUANTILE_CONFIG');
  let numerator = 1n; let denominator = 1n; const [alpha, beta] = s.map(BigInt);
  for (let t = 1; t <= maxDays; t++) {
    numerator *= beta + BigInt(t - 1); denominator *= alpha + beta + BigInt(t - 1);
    if (BigInt(q === 50 ? 2 : 5) * numerator <= denominator) return t;
  }
  return null; // explicit bound, never silently substitutes a finite mean
}
export function priorWeight(s: Shape, observed: number): number {
  shape(s); if (!integer(observed) || observed < 0) throw Error('INVALID_COUNTS');
  return (s[0] + s[1]) / (s[0] + s[1] + observed);
}
function provenance(source: 'questionnaire' | 'common', s: Shape, observations: number): Provenance {
  return { initialSource: source, observations, priorWeight: priorWeight(s, observations),
    label: observations === 0 ? (source === 'questionnaire' ? 'QUESTIONNAIRE_ONLY' : 'COMMON_ONLY')
      : (source === 'questionnaire' ? 'OBSERVED_PLUS_QUESTIONNAIRE' : 'OBSERVED_PLUS_COMMON') };
}
export function evaluate(goal: Goal, logs: readonly Log[], today: string, prior: InitialPrior,
  policy: 'baseline' | 'questionnaire_draft' = 'baseline', config = { samples: 200, horizonDays: 1095, seed: 20261012 }): Result {
  validateInitialPrior(prior, goal.actionSpec);
  if (!['baseline', 'questionnaire_draft'].includes(policy) || !integer(config.samples) || config.samples < 1 || config.samples > 10000
    || !integer(config.horizonDays) || config.horizonDays < 1 || config.horizonDays > 1095
    || !integer(config.seed) || config.seed < 0 || config.seed > 0xffffffff) throw Error('INVALID_CONFIG');
  const raw = rebuildRaw(logs, today, goal); const { counts: c, actualDone, todayStatus } = raw;
  // Baseline ignores optional answers: a=b=Beta(2,2), matching the current formal contract.
  const initial = policy === 'baseline' ? { a: [2, 2] as Shape, b: [2, 2] as Shape, sourceA: 'common' as const, sourceB: 'common' as const } : prior;
  const post = posteriorFromRaw(initial, c);
  const basisA = provenance(initial.sourceA, initial.a, c.dd + c.ds); const basisB = provenance(initial.sourceB, initial.b, c.sd + c.ss);
  const projectedDone = todayStatus === 'UNRECORDED' && actualDone < goal.totalRequired ? actualDone + goal.sessionAmount : actualDone;
  if (!integer(projectedDone)) throw Error('AMOUNT_OVERFLOW');
  const requiredFutureDone = Math.max(0, Math.ceil((goal.totalRequired - projectedDone) / goal.sessionAmount));
  const diagnostics = prior.answers.experience !== 'same_action' && (known(prior.answers.afterDone) || known(prior.answers.afterSkip))
    ? ['ANSWERS_IGNORED_WITHOUT_SAME_ACTION_EXPERIENCE'] : [];
  const common = { ...raw, projectedDone, requiredFutureDone, posterior: post, provenance: { a: basisA, b: basisB }, diagnostics };
  if (actualDone >= goal.totalRequired) return { ...common, core: { status: 'not_applicable', reason: 'COMPLETED' }, completion: { status: 'completed' }, plan: null };
  if (goal.frequency !== 'daily') return { ...common, core: { status: 'not_applicable', reason: 'NON_DAILY' }, completion: { status: 'not_applicable', reason: 'NON_DAILY' }, plan: null };
  const hasA = basisA.observations > 0 || (policy === 'questionnaire_draft' && basisA.initialSource === 'questionnaire');
  const hasB = basisB.observations > 0 || (policy === 'questionnaire_draft' && basisB.initialSource === 'questionnaire');
  let core: Core;
  if (todayStatus !== 'UNRECORDED') core = { status: 'not_applicable', reason: 'TODAY_RECORDED' };
  else if (!hasB) core = policy === 'baseline' ? { status: 'insufficient', reason: 'NO_SKIP_ORIGIN_TRANSITION' } : { status: 'conditional_plan', reason: 'NO_SKIP_BASIS' };
  else {
    const g50 = betaGeometricQuantile(post.b, 50); const g80 = betaGeometricQuantile(post.b, 80);
    if (g50 === null || g80 === null) throw Error('CORE_QUANTILE_BOUND_EXCEEDED');
    core = { status: 'available', g50, g80, basis: basisB };
  }
  let completion: Completion;
  if (!hasA || !hasB) completion = policy === 'baseline' ? { status: 'insufficient', reason: !hasA ? 'NO_DONE_ORIGIN_TRANSITION' : 'NO_SKIP_ORIGIN_TRANSITION' } : { status: 'conditional_plan', reason: 'MISSING_ORIGIN_BASIS' };
  else {
    const draws = drawsFromPosterior(post, config.samples, config.seed);
    const pmf = completionPmf(requiredFutureDone, draws, config.horizonDays, todayStatus === 'SKIPPED' ? 'S' : 'D');
    completion = { status: 'available', p50Days: quantileDays(pmf, .5, config.horizonDays), p80Days: quantileDays(pmf, .8, config.horizonDays),
      scenario: todayStatus === 'UNRECORDED' ? 'TODAY_DONE' : 'CURRENT_STATE', basisA, basisB };
  }
  const remainingSessions = Math.ceil((goal.totalRequired - actualDone) / goal.sessionAmount);
  const plan: Plan | null = policy === 'questionnaire_draft' && (core.status === 'conditional_plan' || completion.status === 'conditional_plan')
    ? { status: 'conditional_plan', remainingSessions, daysFromToday: todayStatus === 'UNRECORDED' ? remainingSessions - 1 : remainingSessions,
      assumption: todayStatus === 'UNRECORDED' ? 'FROM_TODAY_DAILY_ONE_SESSION' : 'FROM_TOMORROW_DAILY_ONE_SESSION' } : null;
  return { ...common, core, completion, plan };
}
