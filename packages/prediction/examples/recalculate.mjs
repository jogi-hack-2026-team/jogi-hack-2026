// scripts/check.mjs test で dist を生成してから、リポジトリのルートで実行する。
// Engine内部の計算例。HTTPで送受信するデータ全体の形式を定めるものではない。
import { pathToFileURL } from 'node:url';
import { predict, DEFAULT_CONFIG } from '../dist/src/index.js';

const goal = { totalRequired: 100, initialProgress: 20, sessionAmount: 10 };
const log = (day, status, amount = status === 'DONE' ? 10 : null) => ({
  localDate: `2026-10-${String(day).padStart(2, '0')}`, status, amount,
});
const original = [log(3, 'DONE'), log(4, 'DONE'), log(5, 'SKIPPED'),
  log(6, 'SKIPPED'), log(7, 'DONE'), log(9, 'DONE')];
export const cases = [
  { name: 'unknown-gap', input: { goal, today: '2026-10-10', logs: original } },
  { name: 'backfill', input: { goal, today: '2026-10-10', logs: [...original, log(8, 'DONE', 15)] } },
  { name: 'correct-backfill', input: { goal, today: '2026-10-10', logs: [...original, log(8, 'SKIPPED')] } },
  { name: 'today-actual', input: { goal, today: '2026-10-10', logs: [...original, log(10, 'DONE', 3)] } },
  { name: 'completed', input: { goal, today: '2026-10-10', logs: [...original, log(10, 'DONE', 40)] } },
  { name: 'today-skipped', input: { goal, today: '2026-10-10', logs: [...original, log(10, 'SKIPPED')] } },
  { name: 'empty-history', input: { goal, today: '2026-10-10', logs: [] } },
  { name: 'done-origin-only', input: { goal, today: '2026-10-10', logs: [log(8, 'DONE'), log(9, 'DONE')] } },
  { name: 'skip-origin-only', input: { goal, today: '2026-10-10', logs: [log(8, 'SKIPPED'), log(9, 'SKIPPED')] } },
  // 実績60に今日の仮の1回を加えても、将来の必要回数は計算上限Hより1回多い。
  { name: 'available-null', input: { goal: { ...goal,
    totalRequired: 60 + (DEFAULT_CONFIG.horizonDays + 2) * goal.sessionAmount },
    today: '2026-10-10', logs: original } },
  { name: 'available-zero', input: { goal: { ...goal, totalRequired: 70 },
    today: '2026-10-10', logs: original } },
];
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(cases.map(({ name, input }) => ({ name, input,
    calculation: predict(input) })), null, 2));
}
