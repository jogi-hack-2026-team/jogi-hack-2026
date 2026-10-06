import { readFileSync } from 'node:fs';

// BEの保存schema／resolverではない。解決済みsnapshotを受け渡す固定例だけを作る。
const document = JSON.parse(readFileSync(new URL('../fixtures-pr118.json', import.meta.url), 'utf8'));
export function resolvedHandoffFixture(id) {
  const example = document.calculationExamples.find(row => row.id === id);
  return structuredClone({ prediction: example.input, config: example.config, expected: example.expected,
    storedSnapshot: { rawAnswers: example.answers, mapping: document.mappingCandidate,
      context: { unit: 'minutes', sessionAmount: example.input.goal.sessionAmount, recordStartDate: '2026-10-01' } },
    currentMapping: { ...structuredClone(document.mappingCandidate), version: 'different-current-definition-fixture' },
    previousPosterior: example.expected.posterior });
}

// 保存済みの初期mappingを選び、前回posterior・現行定義・unitをEngine入力へ混ぜない例。
export function requestFromResolvedFixture(fixture) {
  return { prediction: fixture.prediction, answers: fixture.storedSnapshot.rawAnswers,
    mapping: fixture.storedSnapshot.mapping };
}
