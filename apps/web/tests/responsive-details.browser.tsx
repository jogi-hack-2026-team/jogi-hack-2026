import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { ResponsiveDetails } from '../src/features/today/ResponsiveDetails.tsx';
import { ProgressSummary } from '../src/features/today/ProgressSummary.tsx';
import { amountFormat } from '../src/copy/amount.ts';

// 実コンポーネントをStrictModeで描画。viewport・trusted入力は外側の実Chrome/CDPが担当する。
// API/予測契約はmockせず、ProgressSummaryには実量だけを渡す。
const host = document.getElementById('app')!;
const root = createRoot(host);
let generation = 0;
const inputs: { type: string; key: string | null; trusted: boolean }[] = [];
for (const type of ['click', 'keydown', 'keyup']) {
  document.addEventListener(type, (event) => {
    if (event.target instanceof Element && event.target.closest('summary')) {
      inputs.push({ type, key: event instanceof KeyboardEvent ? event.key : null, trusted: event.isTrusted });
    }
  });
}
function mountDetails() {
  inputs.length = 0;
  flushSync(() => root.render(
    <StrictMode><ResponsiveDetails key={++generation} summary="詳細を開閉" ariaLabel="回帰テスト詳細">
      <p data-testid="details-content">開いているときだけ表示される内容</p>
    </ResponsiveDetails></StrictMode>,
  ));
}
function mountProgress(unit: 'minutes' | 'sessions', done: number, total: number) {
  flushSync(() => root.render(
    <StrictMode><ProgressSummary key={++generation} progress={{ unit, done, total }}
      initialProgress={done} logs={[]} recordStartDate="2026-10-10" today="2026-10-10"
      fmt={amountFormat({ unit })} /></StrictMode>,
  ));
}
function view() {
  const details = host.querySelector('details');
  const content = host.querySelector('[data-testid="details-content"]');
  return {
    width: window.innerWidth, desktop: window.matchMedia('(min-width: 960px)').matches,
    // closed detailsは矩形が残り得るため、UAのcontent-visibilityを含む実際の可視性を読む。
    open: details?.open, contentVisible: !!content && content.checkVisibility(),
    focusedSummary: document.activeElement === details?.querySelector('summary'), inputs: [...inputs],
    amount: host.querySelector('.fr-progress__amount')?.textContent,
    percent: host.querySelector('.fr-progress__percent')?.textContent?.replace(/\s/g, ''),
    ariaPercent: host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow'),
    balances: Object.fromEntries([...host.querySelectorAll('.fr-progress__balance > div')].map(row => [
      row.querySelector('dt')?.textContent, row.querySelector('dd')?.textContent,
    ])),
  };
}
(globalThis as any).__responsiveFixture = { mountDetails, mountProgress, view };
mountDetails();
