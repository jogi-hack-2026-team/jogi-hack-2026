import { makeInitialPrior, evaluate, type Goal, type Answers, type Log } from '../src/prototype.ts';
const goal: Goal = { totalRequired: 100, initialProgress: 0, sessionAmount: 10, frequency: 'daily', actionSpec: 'same-action-v1' };
const answers: Answers = { experience: 'same_action', afterDone: 'often', afterSkip: 'unknown' };
const result = evaluate(goal, [] satisfies readonly Log[], '2026-10-04', makeInitialPrior(answers, goal.actionSpec));
if (result.core.status === 'available') { const numeric: number = result.core.g50; void numeric; }
if (result.completion.status === 'available') { const nullable: number | null = result.completion.p50Days; void nullable; }
// @ts-expect-error a questionnaire choice cannot be supplied as actual ActionLog data
const fakeLog: Log = { localDate: '2026-10-04', status: 'often', amount: null };
// @ts-expect-error experience is restricted to a same-action gate, not personality
const personality: Answers = { experience: 'optimist', afterDone: 'often', afterSkip: 'often' };
// @ts-expect-error no scalar symmetric prior in the proposal input
evaluate(goal, [], '2026-10-04', 2);
void fakeLog; void personality;
