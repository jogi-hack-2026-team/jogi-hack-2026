// Run from the repository root after scripts/check.mjs test has compiled dist.
// This demonstrates the internal calculation; it is not the complete HTTP DTO.
import { predict } from '../dist/src/index.js';

const goal = { totalRequired: 100, initialProgress: 20, sessionAmount: 10 };
const log = (day, status, amount = status === 'DONE' ? 10 : null) => ({
  localDate: `2026-10-${String(day).padStart(2, '0')}`, status, amount,
});
const original = [log(3, 'DONE'), log(4, 'DONE'), log(5, 'SKIPPED'),
  log(6, 'SKIPPED'), log(7, 'DONE'), log(9, 'DONE')];
const cases = [
  { name: 'unknown-gap', input: { goal, today: '2026-10-10', logs: original } },
  { name: 'backfill', input: { goal, today: '2026-10-10', logs: [...original, log(8, 'DONE', 15)] } },
  { name: 'correct-backfill', input: { goal, today: '2026-10-10', logs: [...original, log(8, 'SKIPPED')] } },
  { name: 'today-actual', input: { goal, today: '2026-10-10', logs: [...original, log(10, 'DONE', 3)] } },
  { name: 'completed', input: { goal, today: '2026-10-10', logs: [...original, log(10, 'DONE', 40)] } },
];
console.log(JSON.stringify(cases.map(({ name, input }) => ({ name, input, calculation: predict(input) })), null, 2));
