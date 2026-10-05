// #90から#82へ渡す純粋Engine用の合成入力。DB seedやデモ人物像そのものではない。
// どちらも30日分の記録・実績DONE15回で、固定した今日は未記録。
import { pathToFileURL } from 'node:url';
import { predict } from '../dist/src/index.js';

const input = isDone => ({
  goal: { totalRequired: 60, initialProgress: 0, sessionAmount: 1 },
  today: '2026-10-01',
  logs: Array.from({ length: 30 }, (_, index) => ({
    localDate: `2026-09-${String(index + 1).padStart(2, '0')}`,
    status: isDone(index) ? 'DONE' : 'SKIPPED',
    amount: isDone(index) ? 1 : null,
  })),
});

export const demoInputs = [
  { name: 'fast-resumption', input: input(index => index % 2 === 0) },
  { name: 'slow-resumption', input: input(index => index < 15) },
];

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(demoInputs.map(({ name, input }) => ({ name, input,
    calculation: predict(input) })), null, 2));
}
