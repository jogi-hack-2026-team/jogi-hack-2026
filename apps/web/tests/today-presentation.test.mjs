import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// PriorForecast.tsx（PR #120から取り込んだ検査）はJSXを含むため、Nodeの型除去だけでは読めない。
// テストの中だけ、.tsxをTypeScriptで変換して読み込む。
registerHooks({
  load(url, context, nextLoad) {
    if (!url.startsWith('file:') || !url.endsWith('.tsx')) return nextLoad(url, context);
    const source = readFileSync(fileURLToPath(url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: true },
      fileName: fileURLToPath(url),
    });
    return { format: 'module', source: outputText, shortCircuit: true };
  },
});

const { assertForecastPresentation } = await import('../src/features/prior/PriorForecast.tsx');
const { toForecastView } = await import('../src/features/today/forecast-view.ts');
const { showYesterdayPrompt } = await import('../src/features/today/yesterday-later.ts');
const examples = JSON.parse(readFileSync(new URL('./fixtures/engine-examples.json', import.meta.url), 'utf8'));

const resumed = { success: 3, total: 4 };
const completion = { kind: 'estimate', scenario: 'TODAY_DONE', sources: { a: 'RECORDS', b: 'RECORDS' }, p50Days: 7, p80Days: 14, p50Label: '週A', p80Label: '週B' };
const forecast = (progress) => ({ kind: 'forecast', progress, resumed, completion, core: { kind: 'estimate', days: 2, source: 'RECORDS' } });
const recorded = (progress) => ({ kind: 'today-recorded', todayStatus: 'DONE', progress, resumed, completion: { ...completion, scenario: 'CURRENT_STATE' } });

test('Engineの実出力13件の変換結果は、PR #120最終版の検査を通る', () => {
  assert.equal(examples.cases.length, 13);
  // Engineの入力に単位はないため、両方の単位で確かめる
  for (const { name, prediction } of examples.cases)
    for (const unit of ['minutes', 'sessions']) {
      const view = toForecastView(prediction, unit);
      assert.doesNotThrow(() => assertForecastPresentation(view), `${name} (${unit})`);
      assert.equal(view.kind === 'completed', prediction.progress.completed, name);
    }
});

test('達成済みの超過実績（done > total）は切り詰めずに受け入れる（R-02・R-08）', () => {
  for (const unit of ['minutes', 'sessions'])
    for (const done of [100, 120]) {
      const view = { kind: 'completed', progress: { done, total: 100, unit } };
      assert.doesNotThrow(() => assertForecastPresentation(view));
      assert.equal(view.progress.done, done);
    }
});

test('進捗と状態が食い違う表示データは拒否する', () => {
  const unit = 'minutes';
  assert.throws(() => assertForecastPresentation({ kind: 'completed', progress: { done: 99, total: 100, unit } }), TypeError);
  for (const done of [100, 120]) {
    assert.throws(() => assertForecastPresentation(forecast({ done, total: 100, unit })), TypeError);
    assert.throws(() => assertForecastPresentation(recorded({ done, total: 100, unit })), TypeError);
  }
  assert.doesNotThrow(() => assertForecastPresentation(forecast({ done: 99, total: 100, unit })));
  assert.doesNotThrow(() => assertForecastPresentation(recorded({ done: 99, total: 100, unit })));
});

test('「後で答える」は押したときの対象日だけに効き、日付が変われば問いかけを出し直す', () => {
  const day1 = { yesterdayMissing: true, yesterday: '2026-10-06' };
  const day2 = { yesterdayMissing: true, yesterday: '2026-10-07' };
  assert.equal(showYesterdayPrompt(day1, null), true);
  assert.equal(showYesterdayPrompt(day1, '2026-10-06'), false);
  assert.equal(showYesterdayPrompt(day2, '2026-10-06'), true);
  assert.equal(showYesterdayPrompt({ yesterdayMissing: false, yesterday: '2026-10-06' }, null), false);
  assert.equal(showYesterdayPrompt(undefined, null), false);
});
