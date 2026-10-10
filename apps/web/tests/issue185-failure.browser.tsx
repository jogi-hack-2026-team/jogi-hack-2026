import { act, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { router } from '../src/router.tsx';
import { authClient } from '../src/auth/client.ts';
import { PrivateCacheGuard, privateDataReady, usePrivateEpoch } from '../src/api/session-cache.ts';
import { goalsHttp } from '../src/api/goals-http.ts';
import { ApiError } from '../src/api/client.ts';

// Actual hooks/Router/Better Auth; only API transport, visibility events and wall clock are synthetic.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const transport = (globalThis as any).__sessionTransport;
const host = document.getElementById('app')!;
const root = createRoot(host);
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const goal = (id = 'goal') => ({ id, title: `${transport.owner}-PRIVATE-GOAL`, unit: 'minutes', totalRequired: 100,
  sessionAmount: 10, initialProgress: 0, progressDone: 0, today: '2026-10-10', todayStatus: 'UNRECORDED', timezone: 'UTC',
  recordStartDate: '2026-09-01', hasLogs: false, questionPrior: { a: null, b: null }, answerRevision: 1, goalSettingsRevision: 1 });
let saveError: unknown, getError: unknown;
let fresh: Record<string, unknown> = {};
let holdSave = false, rejectSave: ((error: unknown) => void) | undefined;
const savedResponse = async () => {
  if (holdSave) await new Promise((_resolve, reject) => { rejectSave = reject; });
  if (saveError) throw saveError;
  return { ...goal(), ...fresh };
};
const writes: { mode: string; body: unknown; key?: string; owner?: string }[] = [];
goalsHttp.listGoals = async () => [goal()];
goalsHttp.getGoal = async id => { if (getError) throw getError; return { ...goal(id), ...fresh }; };
goalsHttp.updateGoal = async (_id, body) => { writes.push({ mode: 'edit', body }); return savedResponse(); };
goalsHttp.createGoal = async (body, key, owner) => { writes.push({ mode: 'create', body, key, owner }); return savedResponse(); };
let current: any;
const captures: { checking: boolean; privateDom: boolean }[] = [];
function Diagnostic() {
  const session = authClient.useSession(); const epoch = usePrivateEpoch();
  current = { owner: session.data?.user.id, checking: session.isPending || session.isRefetching || !!session.error, epoch };
  useLayoutEffect(() => { captures.push({ checking: current.checking,
    privateDom: Boolean(host.querySelector('#goal-title')) || Boolean(host.textContent?.includes('-PRIVATE')) }); });
  return null;
}
const ensure = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
const settle = async () => { for (let i = 0; i < 15; i++) await act(tick); };
const input = () => host.querySelector<HTMLInputElement>('#goal-title');
const submit = () => host.querySelector<HTMLButtonElement>('button[type="submit"]');
const view = () => ({ title: input()?.value, total: host.querySelector<HTMLInputElement>('#goal-totalRequired')?.value,
  amount: host.querySelector<HTMLInputElement>('#goal-sessionAmount')?.value,
  invalid: input()?.getAttribute('aria-invalid'), disabled: input()?.disabled, submitDisabled: submit()?.disabled,
  submitText: submit()?.textContent, conflict: host.textContent?.includes('ほかの画面で内容が変わりました') ?? false,
  failed: host.textContent?.includes('保存できませんでした') ?? false,
  unknown: host.textContent?.includes('作成結果を確認できませんでした') ?? false,
  totalInvalid: host.querySelector('#goal-totalRequired')?.getAttribute('aria-invalid'),
  unitInvalid: host.querySelector('[aria-labelledby="goal-unit-label"]')?.getAttribute('aria-invalid'),
  initialDisabled: host.querySelector<HTMLInputElement>('#goal-initialProgress')?.disabled });
const navigate = async (to: string) => { await act(async () => { void router.navigate({ to }); await tick(); }); await settle(); };
const set = async (selector: string, value: string) => act(async () => {
  const target = host.querySelector<HTMLInputElement>(selector)!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(target, value);
  target.dispatchEvent(new Event('input', { bubbles: true })); await tick();
});
const clickSave = async () => { await act(async () => { submit()!.click(); await tick(); }); await settle(); };
const realNow = Date.now; let advance = 0, visibility = 'visible';
Date.now = () => realNow() + advance;
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
const visible = async () => act(async () => {
  advance += 6000; visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange'));
  visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); await tick();
});
const release = async () => { transport.hold = false; transport.held.splice(0).forEach((resolve: () => void) => resolve()); await settle(); };
const api = (status: number, code: string) => new ApiError(status, { error: { code, message: 'synthetic rejection',
  ...(status === 422 ? { fields: [{ path: 'body/title', message: 'synthetic invalid title' }] } : {}) } });
async function run() {
  await act(async () => { root.render(<QueryClientProvider client={client}><PrivateCacheGuard /><Diagnostic /><RouterProvider router={router} /></QueryClientProvider>); await tick(); }); await settle();
  const results = [], failures: string[] = [];
  const cases = [
    { label: 'edit409', mode: 'edit', error: api(409, 'GOAL_SETTINGS_CONFLICT') },
    { label: 'edit409/get503', mode: 'edit', error: api(409, 'GOAL_SETTINGS_CONFLICT'), getFails: true },
    { label: 'edit503', mode: 'edit', error: api(503, 'UNAVAILABLE') },
    { label: 'editNetwork', mode: 'edit', error: new TypeError('synthetic network failure') },
    { label: 'edit422', mode: 'edit', error: api(422, 'VALIDATION_ERROR') },
    { label: 'create422', mode: 'create', error: api(422, 'VALIDATION_ERROR') },
    { label: 'create503', mode: 'create', error: api(503, 'UNAVAILABLE') },
  ];
  for (const scenario of cases) {
    saveError = null; getError = null; await navigate('/');
    await navigate(scenario.mode === 'create' ? '/goals/new' : '/goals/goal/edit');
    await visible(); await settle(); ensure(input(), scenario.label + ': initial form absent');
    await set('#goal-title', 'A-PRIVATE-185-DRAFT'); await set('#goal-totalRequired', '123'); await set('#goal-sessionAmount', '17');
    saveError = scenario.error; await clickSave(); const before = view(), count = writes.length;
    ensure(before.title === 'A-PRIVATE-185-DRAFT', scenario.label + ': input was lost before session check');
    ensure(before.invalid === 'true' || before.failed || before.conflict, scenario.label + ': initial failure absent');
    const raw = sessionStorage.getItem('future-roi:create-attempt:A');
    transport.hold = true; const reads = transport.reads; await visible(); await settle();
    ensure(transport.reads > reads && current.checking && !input() && !host.textContent?.includes('-PRIVATE'), scenario.label + ': checking did not remove private DOM');
    if (scenario.getFails) getError = api(503, 'UNAVAILABLE');
    await release(); const after = view();
    ensure(current.owner === 'A' && !current.checking && privateDataReady(current.epoch), scenario.label + ': healthy A confirmation did not complete');
    ensure(writes.length === count, scenario.label + ': automatic resend');
    ensure(location.pathname === (scenario.mode === 'create' ? '/goals/new' : '/goals/goal/edit'), scenario.label + ': unexpected navigation');
    if (raw) ensure(sessionStorage.getItem('future-roi:create-attempt:A') === raw, scenario.label + ': raw attempt changed during check');
    // A failed fresh GET may safely keep the form hidden. Test recovery before concluding its input was lost.
    let afterRecovery: ReturnType<typeof view> | undefined;
    if (scenario.getFails) {
      ensure(submit()?.disabled !== false, scenario.label + ': save allowed before latest GET recovery');
      getError = null;
      const retry = [...host.querySelectorAll<HTMLButtonElement>('button')].find(button =>
        ['再読み込み', '最新の内容を読み込む'].includes(button.textContent?.trim() ?? ''));
      ensure(retry, scenario.label + ': explicit GET recovery action absent');
      await act(async () => { retry!.click(); await tick(); }); await settle();
      afterRecovery = view();
      ensure(writes.length === count, scenario.label + ': reload automatically saved');
    }
    const recovered = afterRecovery ?? after;
    const preserved = recovered.title === before.title && recovered.total === before.total && recovered.amount === before.amount
      && recovered.invalid === before.invalid && recovered.disabled === before.disabled
      && (scenario.getFails ? recovered.conflict || Boolean(host.textContent?.includes('最新の設定・回答を読み込みました'))
        : recovered.conflict === before.conflict && recovered.failed === before.failed && recovered.unknown === before.unknown
          && recovered.submitDisabled === before.submitDisabled && recovered.submitText === before.submitText);
    if (!preserved) failures.push(scenario.label);
    results.push({ label: scenario.label, owner: current.owner, before, after, ...(afterRecovery ? { afterRecovery } : {}), preserved, writesDuringCheck: writes.length - count,
      rawAttemptUnchanged: raw ? sessionStorage.getItem('future-roi:create-attempt:A') === raw : null, privateDomRemoved: true });
    // End a result-unknown create only through explicit same key/body confirmation, without resetting storage.
    if (raw) {
      saveError = null; getError = null; const previous = writes.at(-1)!; await clickSave();
      ensure(writes.length === count + 1, 'explicit create recovery did not send exactly once');
      ensure(JSON.stringify(writes.at(-1)) === JSON.stringify(previous), 'explicit recovery changed owner/key/body');
      ensure(sessionStorage.getItem('future-roi:create-attempt:A') === null && location.pathname === '/goals', 'explicit recovery did not end attempt');
    }
  }
  const hidden = (label: string) => ensure(!input() && !host.textContent?.includes('-PRIVATE'), label + ': private DOM exposed');
  const check = async () => { await visible(); await settle(); };
  const atom = authClient.$store.atoms.session;
  let knownSession = atom.get().data!;
  const atomOwner = (owner: string | null) => {
    const previous = atom.get();
    if (previous.data) knownSession = previous.data;
    atom.set({ ...previous, data: owner === null ? null : { ...knownSession, user: { ...knownSession.user, id: owner } },
      error: null, isPending: false, isRefetching: false });
  };
  const reset = async (mode = 'edit') => {
    saveError = getError = null; fresh = {}; holdSave = false; rejectSave = undefined;
    transport.hold = false; transport.failure = null; transport.owner = 'A';
    await navigate('/'); await check();
    await navigate(mode === 'create' ? '/goals/new' : '/goals/goal/edit');
    ensure(input(), 'reset form missing');
    await set('#goal-title', 'A-PRIVATE-185-DRAFT'); await set('#goal-totalRequired', '123'); await set('#goal-sessionAmount', '17');
  };
  const failed = async (error = api(503, 'UNAVAILABLE')) => { saveError = error; await clickSave(); };
  const record = (label: string, extra: Record<string, unknown> = {}) => results.push({ label, preserved: true, owner: current.owner, after: view(), ...extra } as any);
  const absentOldFailure = (label: string) => ensure(!view().failed && !view().conflict && view().invalid !== 'true'
    && view().title !== 'A-PRIVATE-185-DRAFT', label + ': old failure/draft resurrected');
  const formSubmit = async () => { await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await tick(); }); await settle(); };
  const reload = async () => {
    const button = [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === '最新の内容を読み込む');
    ensure(button, 'explicit latest GET action missing'); await act(async () => { button!.click(); await tick(); }); await settle();
  };
  for (const failure of ['503', '429', 'network']) {
    await reset(); await failed(); const count = writes.length;
    transport.failure = failure; await check(); hidden('session/' + failure);
    transport.failure = null; await check(); absentOldFailure('session/' + failure);
    ensure(writes.length === count, 'session failure automatic resend'); record('session/' + failure + '/A', { writesDuringCheck: 0 });
  }
  for (const boundary of ['owner', 'batchedOwner', 'batchedLogout', 'signal', 'storage', 'goal', 'public', 'pendingGoal']) {
    await reset(); await failed(); const count = writes.length;
    if (boundary === 'owner') { transport.owner = 'B'; await check(); transport.owner = 'A'; await check(); }
    else if (boundary === 'batchedOwner' || boundary === 'batchedLogout') {
      await act(async () => { atomOwner(boundary === 'batchedOwner' ? 'B' : null); atomOwner('A'); await tick(); }); await settle();
    } else if (boundary === 'signal') {
      await act(async () => { const signal = authClient.$store.atoms.$sessionSignal; signal.set(!signal.get()); await tick(); }); await settle(); await check();
    } else if (boundary === 'storage') {
      await act(async () => { window.dispatchEvent(new StorageEvent('storage', { key: 'better-auth.message', newValue: JSON.stringify({ event: 'session' }) })); await tick(); }); await settle(); await check();
    } else if (boundary === 'goal') { await navigate('/goals/goal2/edit'); await navigate('/goals/goal/edit'); }
    else if (boundary === 'public') { await navigate('/'); await navigate('/goals/goal/edit'); }
    else {
      await act(async () => { void router.navigate({ to: '/goals/goal2/edit' }); void router.navigate({ to: '/goals/goal/edit' }); await tick(); }); await settle();
    }
    ensure(input(), boundary + ': fresh form missing'); absentOldFailure(boundary);
    ensure(writes.length === count, boundary + ': automatic resend'); record('departure/' + boundary, { writesDuringCheck: 0 });
  }
  for (const mode of ['edit', 'create']) {
    await reset(mode); await failed(api(422, 'VALIDATION_ERROR')); await set('#goal-title', 'A-PRIVATE-CORRECTED');
    const count = writes.length; await check();
    ensure(view().title === 'A-PRIVATE-CORRECTED' && view().invalid !== 'true' && !view().failed && !view().disabled, mode + ': correction lost');
    ensure(writes.length === count && sessionStorage.getItem('future-roi:create-attempt:A') === null, '422 correction sent/generated attempt');
    record(mode + '/422-correct-check');
  }
  await reset(); await failed(new ApiError(422, { error: { code: 'VALIDATION_ERROR', message: 'synthetic multiple fields',
    fields: [{ path: 'body/title', message: 'synthetic title' }, { path: 'body/totalRequired', message: 'synthetic total' }] } }));
  const multipleCount = writes.length;
  await set('#goal-sessionAmount', '18'); await check();
  ensure(view().invalid === 'true' && view().totalInvalid === 'true' && view().amount === '18', 'unrelated edit cleared field failures');
  await set('#goal-title', 'A-PRIVATE-CORRECTED'); await check();
  ensure(view().invalid !== 'true' && view().totalInvalid === 'true' && view().title === 'A-PRIVATE-CORRECTED', 'partial correction lost remaining failure');
  await set('#goal-totalRequired', '124'); await check();
  ensure(view().invalid !== 'true' && view().totalInvalid !== 'true' && view().total === '124' && view().amount === '18', 'complete correction resurrected failures');
  ensure(writes.length === multipleCount, 'partial correction resent'); record('edit/422-multiple-partial-check');
  try {
  await reset(); await failed(api(409, 'GOAL_SETTINGS_CONFLICT')); const conflictCount = writes.length;
  fresh = { unit: 'sessions', unitLocked: true, hasLogs: true, answerRevision: 8, goalSettingsRevision: 9, totalRequired: 150,
    sessionAmount: 20, initialProgress: 5, targetDate: '2099-01-01' };
  await check();
  ensure(view().title === 'A-PRIVATE-185-DRAFT' && view().total === '123' && view().amount === '17', 'fresh GET replaced conflicted input: ' + JSON.stringify(view()));
  ensure(view().submitDisabled, 'fresh GET cleared conflict lock: ' + JSON.stringify(view()));
  ensure(view().initialDisabled, 'fresh hasLogs lock missing');
  await formSubmit(); ensure(writes.length === conflictCount, 'programmatic conflict submit sent');
  await reload(); ensure(!view().conflict && view().title === 'A-PRIVATE-185-DRAFT' && view().total === '123', 'explicit rebase lost edited input');
  await check(); ensure(!view().conflict && view().title === 'A-PRIVATE-185-DRAFT', 'check resurrected old409');
  const lockedButtons = [...host.querySelectorAll<HTMLButtonElement>('[aria-labelledby="goal-unit-label"] button')];
  ensure(lockedButtons.length === 2 && lockedButtons.every(b => b.disabled), 'fresh unitLocked missing');
  await set('#goal-targetDate', '2020-01-01'); await formSubmit();
  ensure(host.querySelector('#goal-targetDate')?.getAttribute('aria-invalid') === 'true' && writes.length === conflictCount, 'fresh date validation missing');
  await set('#goal-targetDate', '2099-01-02'); saveError = api(503, 'UNAVAILABLE'); await formSubmit();
  ensure(writes.length === conflictCount + 1 && (writes.at(-1)!.body as any).expectedGoalSettingsRevision === 9, 'explicit rebase did not use latest revision');
  record('edit/409-fresh-lock-rebase-validation', { freshRevision: 9 });
  } catch (error) {
    failures.push('edit/409-fresh-lock-rebase-validation');
    results.push({ label: 'edit/409-fresh-lock-rebase-validation', preserved: false, error: String(error), view: view() } as any);
  }
  await reset();
  await act(async () => { host.querySelectorAll<HTMLButtonElement>('[aria-labelledby="goal-unit-label"] button')[1]!.click(); await tick(); }); await settle();
  await failed(api(409, 'GOAL_SETTINGS_CONFLICT')); const editedUnitCount = writes.length;
  fresh = { unit: 'minutes', unitLocked: true, hasLogs: true, goalSettingsRevision: 10 };
  await check(); ensure(view().submitDisabled, 'fresh unit lock cleared conflict');
  await reload(); await check();
  await formSubmit(); ensure(writes.length === editedUnitCount, 'edited incompatible unit sent after rebase');
  const restoreUnit = [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.includes('保存済みの単位'));
  ensure(restoreUnit, 'edited unit was lost instead of retaining/validating it');
  await act(async () => { restoreUnit!.click(); await tick(); }); await settle();
  saveError = api(503, 'UNAVAILABLE'); await formSubmit();
  ensure(writes.length === editedUnitCount + 1 && (writes.at(-1)!.body as any).expectedGoalSettingsRevision === 10, 'restored unit did not use explicit latest revision');
  record('edit/409-edited-unit-locked-rebase');
  for (const scenario of cases.filter(c => !c.getFails)) {
    await reset(scenario.mode); holdSave = true; await clickSave(); ensure(rejectSave, scenario.label + ': pending write not reached');
    const count = writes.length, raw = sessionStorage.getItem('future-roi:create-attempt:A');
    transport.hold = true; await visible(); await settle(); hidden(scenario.label);
    await act(async () => { rejectSave!(scenario.error); await tick(); }); await settle(); hidden(scenario.label + '/rejected');
    ensure(current.checking, 'pending rejection ended session check'); await release(); const restored = view();
    ensure(restored.title === 'A-PRIVATE-185-DRAFT' && (restored.invalid === 'true' || restored.failed || restored.conflict), scenario.label + ': pending failure lost');
    ensure(writes.length === count, scenario.label + ': pending rejection resent');
    if (scenario.mode === 'create') {
      if (scenario.label === 'create422') ensure(!restored.disabled && sessionStorage.getItem('future-roi:create-attempt:A') === null, 'pending422 attempt not ended/editable');
      else {
        ensure(restored.disabled && sessionStorage.getItem('future-roi:create-attempt:A') === raw, 'pending503 raw not frozen');
        const prior = writes.at(-1); holdSave = false; saveError = null; await clickSave();
        ensure(JSON.stringify(writes.at(-1)) === JSON.stringify(prior) && writes.length === count + 1, 'pending503 recovery changed operation');
      }
    }
    record('pending-check/' + scenario.label, { privateDomRemoved: true, automaticResend: false });
  }
  await reset('create'); holdSave = true; await clickSave();
  const k1 = JSON.parse(sessionStorage.getItem('future-roi:create-attempt:A')!);
  const k2 = JSON.stringify({ ...k1, key: '22222222-2222-4222-8222-222222222222', body: { ...k1.body, title: 'A-PRIVATE-K2' } });
  const bRaw = JSON.stringify({ ...k1, owner: 'B', key: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', body: { ...k1.body, title: 'B-PRIVATE-RAW' } });
  sessionStorage.setItem('future-roi:create-attempt:A', k2); sessionStorage.setItem('future-roi:create-attempt:B', bRaw);
  transport.hold = true; await visible(); await settle();
  await act(async () => { rejectSave!(api(422, 'VALIDATION_ERROR')); await tick(); }); await settle(); hidden('K1/422');
  await release(); ensure(view().title === 'A-PRIVATE-K2' && view().disabled && view().invalid !== 'true', 'K1 field error contaminated K2');
  ensure(sessionStorage.getItem('future-roi:create-attempt:A') === k2 && sessionStorage.getItem('future-roi:create-attempt:B') === bRaw, 'late422 changed raw');
  const k2Count = writes.length; holdSave = false; saveError = null; await clickSave();
  ensure(writes.length === k2Count + 1 && writes.at(-1)!.key === JSON.parse(k2).key && sessionStorage.getItem('future-roi:create-attempt:B') === bRaw, 'explicit K2 did not preserve B raw');
  record('create/late-K1-422-K2-B-raw');
  for (const boundary of ['public', 'goal', 'pendingGoal', 'owner']) {
    await reset(); holdSave = true; await clickSave(); const rejectOld = rejectSave!;
    if (boundary === 'owner') { transport.owner = 'B'; await check(); transport.owner = 'A'; await check(); }
    else if (boundary === 'public') { await navigate('/'); await navigate('/goals/goal/edit'); }
    else if (boundary === 'goal') { await navigate('/goals/goal2/edit'); await navigate('/goals/goal/edit'); }
    else { await act(async () => { void router.navigate({ to: '/goals/goal2/edit' }); void router.navigate({ to: '/goals/goal/edit' }); await tick(); }); await settle(); }
    const count = writes.length; await act(async () => { rejectOld(api(409, 'GOAL_SETTINGS_CONFLICT')); await tick(); }); await settle();
    ensure(input(), boundary + ': form blocked after stale result'); absentOldFailure('late409/' + boundary);
    ensure(writes.length === count, 'stale409 automatic resend'); record('late409/departure/' + boundary);
  }
  ensure(!captures.some(c => c.checking && c.privateDom), 'private DOM was observed during session check');
  ensure(transport.writes === 0, 'unexpected auth/private transport writes');
  await act(async () => root.unmount()); client.clear(); Date.now = realNow;
  return { results, failures, authWrites: transport.writes, writes: writes.length, observations: captures.length };
}
run().then(result => { document.getElementById('result')!.textContent = JSON.stringify({ ok: true, ...result }); })
  .catch(error => { document.getElementById('result')!.textContent = JSON.stringify({ ok: false, error: error.stack ?? String(error) }); });
