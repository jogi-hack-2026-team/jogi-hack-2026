import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AmountEditor } from '../src/features/logs/AmountEditor.tsx';
import { RecordChoiceBar } from '../src/features/logs/RecordChoiceBar.tsx';
import { amountFormat, RECORD_AMOUNT_MAX } from '../src/copy/amount.ts';
import { todayCopy } from '../src/copy/today.ts';

// 実Reactコンポーネントの入力・連打・境界・未保存draftを実Chrome DOMで検査。
// save callbackを観測する合成transport。実API/DB保存の証跡とは区別する。
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const host = document.getElementById('app')!;
const root = createRoot(host);
const results: string[] = [];
const writes: any[] = [];
let cancels = 0;
const ensure = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const tick = () => new Promise(resolve => setTimeout(resolve, 1));
const render = async (node: React.ReactNode) => {
  await act(async () => { root.render(null); await tick(); });
  await act(async () => { root.render(node); await tick(); });
};
const input = () => host.querySelector<HTMLInputElement>('input')!;
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === text)!;
const plus = () => host.querySelector<HTMLButtonElement>('button[aria-label^="量を増やす"]')!;
const minus = () => host.querySelector<HTMLButtonElement>('button[aria-label^="量を減らす"]')!;
const click = async (target: HTMLButtonElement) => act(async () => { ensure(target, 'button absent'); target.click(); await tick(); });
const enter = async (text: string) => act(async () => {
  const target = input(); ensure(target, 'input absent');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(target, text);
  target.dispatchEvent(new Event('input', {bubbles: true})); await tick();
});
const key = async (key: string, init: KeyboardEventInit = {}) => act(async () => { input().dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true, ...init})); await tick(); });
const editor = (initial = 20, busy = false, unit: 'minutes' | 'sessions' = 'minutes', sessionAmount = 20) => <AmountEditor label="量のテスト" initial={initial} sessionAmount={sessionAmount} fmt={amountFormat({unit})} busy={busy} onSubmit={amount => writes.push({amount})} onCancel={() => { cancels++; }} />;
const saver = (busy = false) => ({isSaving: busy, saving: busy ? {choice: {status: 'DONE'}} : null, failure: null, isStaleDate: () => false, save: (vars: unknown) => writes.push(vars)} as any);
function Dock({initial = 20, amount = null, busy = false, locked = false}: {initial?: number; amount?: number | null; busy?: boolean; locked?: boolean}) {
  const [editing, setEditing] = useState(false);
  return <RecordChoiceBar today="2026-10-10" sessionAmount={initial} fmt={amountFormat({unit: 'minutes'})} current={amount === null ? null : {localDate: '2026-10-10', status: 'DONE', amount}} saver={saver(busy)} locked={locked} editingAmount={editing} onEditingAmountChange={setEditing} onRefresh={() => {}} />;
}

async function run() {
  await render(editor());
  ensure(!host.querySelector('.fr-amount__prediction-note'), 'configured amount shows unnecessary draft note');
  ensure(input().getAttribute('aria-describedby')?.split(' ').every(id => document.getElementById(id)), 'configured amount has dangling description');
  await click(plus());
  const note = todayCopy.amountPredictionNote('20分');
  ensure(host.textContent?.includes(note), 'different amount does not explain configured forecast basis');
  ensure(input().getAttribute('aria-describedby')?.split(' ').some(id => document.getElementById(id)?.textContent === note), 'prediction note is not connected to input');
  ensure(writes.length === 0, 'draft note caused a save');
  await click(minus());
  ensure(!host.querySelector('.fr-amount__prediction-note'), 'returning to configured amount retains draft note');
  ensure(input().getAttribute('aria-describedby')?.split(' ').every(id => document.getElementById(id)), 'returning to configured amount has dangling description');
  results.push('different draft amount explains configured forecast basis and removes note on return without saving');
  await act(async () => { plus().click(); plus().click(); plus().click(); await tick(); });
  ensure(input().value === '80', 'batched increases lost a step');
  ensure(writes.length === 0, 'step changed persisted data');
  results.push('same-batch repeated increases use successive state without saving');

  await key('ArrowDown'); ensure(input().value === '60', 'ArrowDown step');
  await key('ArrowUp'); ensure(input().value === '80', 'ArrowUp step');
  ensure(input().getAttribute('role') === 'spinbutton' && input().getAttribute('aria-valuenow') === '80', 'spinbutton value absent');
  ensure(plus().getAttribute('aria-label')?.includes('20分ずつ'), 'accessible step amount absent');
  results.push('keyboard arrows and spinbutton semantics preserve Goal step');

  await enter('2'); await click(minus()); ensure(input().value === '1' && minus().disabled, 'minimum boundary');
  await enter(String(RECORD_AMOUNT_MAX - 1)); await click(plus()); ensure(input().value === String(RECORD_AMOUNT_MAX) && plus().disabled, 'maximum boundary');
  results.push('min/max clamp and direction-specific disabled states');

  for (const text of ['', '0', '1.5', String(RECORD_AMOUNT_MAX + 1), 'abc']) {
    await enter(text); ensure(plus().disabled && minus().disabled, 'invalid value enabled step: ' + text);
    const count = writes.length; await key('Enter'); ensure(writes.length === count, 'invalid Enter saved');
    ensure(input().getAttribute('aria-invalid') === 'true', 'invalid input error not connected');
  }
  results.push('empty/zero/fraction/overflow/text remain invalid without silent substitution or save');
  await enter('１２３'); await click(plus()); ensure(input().value === '143', 'fullwidth integers lost');
  await enter('1,000'); await key('ArrowDown'); ensure(input().value === '980', 'comma integers lost');
  results.push('existing fullwidth/comma direct-input contract retained');

  await key('Enter', {repeat: true}); await key('Enter', {isComposing: true}); ensure(writes.length === 0, 'repeat/IME Enter submitted');
  await key('Enter'); ensure(writes.length === 1 && writes[0].amount === 980, 'explicit Enter amount');
  results.push('only explicit non-IME non-repeated Enter submits entered integer');
  await render(editor(7, true)); ensure(input().disabled && plus().disabled && minus().disabled, 'busy controls enabled');
  await key('Enter'); ensure(writes.length === 1, 'busy Enter submitted');
  results.push('busy blocks both buttons, input, Enter and submit');

  await render(editor(3, false, 'sessions', 2)); await click(plus()); ensure(input().value === '5', 'session-unit step changed');
  ensure(plus().getAttribute('aria-label')?.includes('2回ずつ'), 'session-unit label changed');
  results.push('count Goal remains integer count using its own sessionAmount');

  writes.length = 0;
  await render(<Dock />); await click(plus()); ensure(input().value === '40' && writes.length === 0, 'dock increase did not open unsaved draft');
  ensure(document.activeElement === host.querySelector('.fr-amount'), 'opened amount editor did not receive group focus');
  ensure(document.activeElement?.getAttribute('role') === 'group' && document.activeElement?.getAttribute('aria-label') === todayCopy.amountTodayLabel, 'editor group is unnamed');
  await click(button(todayCopy.back)); ensure(!input() && writes.length === 0, 'cancel persisted or did not close');
  ensure(document.activeElement === plus(), 'cancel did not return focus to original plus entry');
  await click(button(todayCopy.changeAmount)); ensure(input().value === '20', 'cancelled draft returned');
  await click(button(todayCopy.back)); ensure(document.activeElement === button(todayCopy.changeAmount), 'ordinary edit cancel focus');
  await click(minus()); ensure(input().value === '1', 'dock decrease lower clamp');
  await click(button(todayCopy.back));
  ensure(document.activeElement === minus(), 'minus edit cancel focus');
  results.push('dock +/- opens unsaved stepped editor; cancel and ordinary edit discard draft');

  await render(<Dock amount={37} />); await click(plus()); ensure(input().value === '57', 'correction ignored current amount');
  await click(button(todayCopy.saveWithAmount));
  ensure(writes.length === 1 && writes[0].localDate === '2026-10-10' && writes[0].choice.amount === 57, 'explicit correction changed save date/amount');
  results.push('correction starts from saved amount and explicit save preserves bound date');
  await render(<Dock initial={1} />); ensure(minus().disabled, 'dock minimum enabled');
  await render(<Dock amount={RECORD_AMOUNT_MAX} />); ensure(plus().disabled, 'dock maximum enabled');
  await render(<Dock busy />); ensure(!plus() && !minus(), 'busy dock exposed +/-');
  await render(<Dock locked />); ensure(!plus() && !minus(), 'locked dock exposed +/-');
  results.push('dock min/max and existing busy/locked visibility retained');

  writes.length = 0; await render(<Dock />);
  const rest = [...host.querySelectorAll<HTMLButtonElement>('.fr-choice')].find(b => b.textContent?.includes(todayCopy.choiceRest))!;
  await click(rest); ensure(writes.length === 1 && writes[0].choice.status === 'SKIPPED' && writes[0].choice.amount === null, 'rest contract altered');
  results.push('rest remains SKIPPED/null with no zero amount');
  ensure(host.textContent?.includes(todayCopy.choiceRest), 'rest label lost');
  document.getElementById('result')!.textContent = JSON.stringify({ok: true, results, writes});
}
run().catch(error => { document.getElementById('result')!.textContent = JSON.stringify({ok: false, error: String(error), results, writes}); });
