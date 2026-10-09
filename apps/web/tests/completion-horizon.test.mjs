import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { mixtureCompletionQuantiles } from '../../../packages/prediction/src/completion.ts';

// 実部品のHTMLと読み上げを検査する。SSRではCSS・幅の測定は実行せず、実ブラウザ確認とは区別する。
registerHooks({
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
    if (!url.startsWith('file:') || !url.endsWith('.tsx')) return nextLoad(url, context);
    const { outputText } = ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: true },
      fileName: fileURLToPath(url),
    });
    return { format: 'module', source: outputText, shortCircuit: true };
  },
});

const { OutlookPanel } = await import('../src/features/today/OutlookPanel.tsx');
const { toForecastView } = await import('../src/features/today/forecast-view.ts');
const { assertForecastPresentation, PriorForecast } = await import('../src/features/prior/PriorForecast.tsx');
const { todayCopy, completionNoteFor } = await import('../src/copy/today.ts');
const { amountFormat } = await import('../src/copy/amount.ts');
const examples = JSON.parse(readFileSync(new URL('./fixtures/engine-examples.json', import.meta.url), 'utf8'));
const base = examples.cases.find(({ prediction }) => prediction.todayStatus === 'UNRECORDED' && prediction.completion.status === 'available').prediction;
const today = '2026-10-09';
const horizon = 1095;
const outsideText = '10回中8回の完了時期の目安は、計算範囲の約3年以内には収まりません。';
const quantiles = (a) => mixtureCompletionQuantiles([{ a, b: 0 }], 'DONE', 1, horizon);

function present(q, provenance, recorded = false) {
  // b=0の人工境界条件。利用者の実データ・発生頻度・予測精度を検証する例ではない。
  const prediction = { ...base, today, todayStatus: recorded ? 'DONE' : 'UNRECORDED', completion: { status: 'available', scenario: recorded ? 'CURRENT_STATE' : 'TODAY_DONE', ...q } };
  const extras = provenance ? { provenance, plan: null, sessionAmount: 15 } : undefined;
  const view = toForecastView(prediction, 'minutes', extras);
  assertForecastPresentation(view);
  return view;
}

function render(completion) {
  return renderToStaticMarkup(createElement(OutlookPanel, { completion, today, title: '完了の目安', fmt: amountFormat({ unit: 'minutes' }) }));
}

test('F(H)=0.79では有限P50を保持し、P80の範囲外を期間外80%と説明しない', () => {
  const q = quantiles(0.79);
  assert.deepEqual(q, { p50Days: 1, p80Days: null });
  const view = present(q);
  assert.equal(view.completion.p50Label, '10月5日の週');
  const html = render(view.completion);
  assert.match(html, /fr-outlook__p50">10月5日の週ごろ/);
  assert.ok(html.includes(outsideText));
  assert.match(html, /aria-label="日付の軸。目安の日付に印。10回中8回の完了時期の目安は、計算範囲/);
  assert.doesNotMatch(html, /10回中8回は3年以上先|10回中8回の日付は3年以上先/);
  assert.equal(todayCopy.completionP80Over3Years, outsideText);
});

test('F(H)=0.20では両方nullを有限P50の場合と区別する', () => {
  const q = quantiles(0.20);
  assert.deepEqual(q, { p50Days: null, p80Days: null });
  const view = present(q);
  assert.equal(view.completion.p50Label, null);
  const html = render(view.completion);
  assert.match(html, /fr-outlook__p50">3年以上先/);
  assert.ok(html.includes(outsideText));
  assert.doesNotMatch(html, /日付の軸|10回中8回は3年以上先/);
});

test('0.80ちょうどと既存ε内は有限P80、εより外はnullのまま表示する', () => {
  for (const a of [0.8, 0.8 - 0.5e-12]) {
    const q = quantiles(a);
    assert.deepEqual(q, { p50Days: 1, p80Days: 1 });
    const html = render(present(q).completion);
    assert.match(html, /10回中8回は10月5日の週まで/);
    assert.ok(!html.includes(outsideText));
  }
  assert.equal(quantiles(0.8 - 2e-12).p80Days, null);
});

test('H日目と0日の有限分位点を週丸めによって範囲外にしない', () => {
  const q = mixtureCompletionQuantiles([{ a: Math.pow(0.8, 1 / horizon), b: 0 }], 'DONE', horizon, horizon);
  assert.deepEqual(q, { p50Days: horizon, p80Days: horizon });
  assert.ok(!render(present(q).completion).includes(outsideText));
  const zero = mixtureCompletionQuantiles([{ a: 0.2, b: 0 }], 'DONE', 0, horizon);
  assert.deepEqual(zero, { p50Days: 0, p80Days: 0 });
  const view = present(zero);
  assert.equal(view.completion.p50Label, '10月5日の週');
  assert.equal(view.completion.p80Label, '10月5日の週');
  assert.ok(!render(view.completion).includes(outsideText));
  const nextWeek = present({ p50Days: 3, p80Days: 3 });
  assert.equal(nextWeek.completion.p80Label, '10月12日の週');
});

test('質問・実記録・両者併用と記録済みでも、P80の意味と出所・注釈を保持する', () => {
  for (const provenance of [{ a: 'RECORDS', b: 'RECORDS' }, { a: 'QUESTION', b: 'QUESTION' }, { a: 'QUESTION_AND_RECORDS', b: 'RECORDS' }]) {
    for (const recorded of [false, true]) {
      const view = present(quantiles(0.79), provenance, recorded);
      assert.equal(view.kind, recorded ? 'today-recorded' : 'forecast');
      assert.equal(view.completion.scenario, recorded ? 'CURRENT_STATE' : 'TODAY_DONE');
      assert.deepEqual(view.completion.sources, provenance);
      const html = render(view.completion);
      assert.ok(html.includes(outsideText));
      assert.ok(html.includes(completionNoteFor(provenance)));
      if (provenance.a === 'QUESTION' || provenance.a === 'QUESTION_AND_RECORDS') assert.match(html, /初期の回答は仮定です/);
    }
  }
});

test('達成済み・不足・条件付き計画はP80 nullの説明と混同しない', () => {
  const completed = toForecastView({ ...base, progress: { ...base.progress, done: base.progress.total, completed: true }, completion: { status: 'completed' } }, 'minutes');
  assert.equal(completed.kind, 'completed');
  const completedHtml = renderToStaticMarkup(createElement(PriorForecast, { view: completed }));
  assert.match(completedHtml, /目標を達成しました/);
  assert.ok(!completedHtml.includes(outsideText));
  const insufficient = { ...base, coreMetric: { status: 'insufficient', reason: 'NO_SKIP_ORIGIN_TRANSITION' }, completion: { status: 'insufficient', reason: 'NO_DONE_ORIGIN_TRANSITION' } };
  const unavailable = toForecastView(insufficient, 'minutes');
  assert.equal(unavailable.completion.kind, 'insufficient');
  assert.ok(!render(unavailable.completion).includes(outsideText));
  const planned = toForecastView(insufficient, 'minutes', { provenance: { a: 'NONE', b: 'NONE' }, plan: { remainingAmount: 40, remainingSessions: 3, lastSessionAmount: 10 }, sessionAmount: 15 });
  assert.equal(planned.completion.kind, 'conditional');
  const planHtml = render(planned.completion);
  assert.match(planHtml, /あと3回分|日数の予測ではありません/);
  assert.ok(!planHtml.includes(outsideText));
});
