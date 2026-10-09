import { act, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { router } from '../src/router.tsx';
import { authClient } from '../src/auth/client.ts';
import { getPrivateEpoch, PrivateCacheGuard, usePrivateEpoch } from '../src/api/session-cache.ts';
import { goalKeys, goalsHttp } from '../src/api/goals-http.ts';
import { todayHttp } from '../src/api/today-http.ts';

// 実SDK・実routerと画面を使う。HTTP/event/時計だけ制御し、実認証E2Eと区別する。
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const transport = (globalThis as any).__sessionTransport;
const goal = (owner = transport.owner, revision = 1) => ({ id: 'goal', title: `${owner}-PRIVATE-GOAL`, unit: 'minutes', totalRequired: 100, sessionAmount: 10, initialProgress: 0, progressDone: 0, today: '2026-10-09', todayStatus: 'UNRECORDED', timezone: 'UTC', recordStartDate: '2026-09-01', hasLogs: false, questionPrior: { a: null, b: null }, answerRevision: revision, goalSettingsRevision: settingsRevision });
let revision = 1;
let settingsRevision = 1;
let saved: unknown[] = [];
let finishSave: ((data: any) => void) | undefined;
goalsHttp.listGoals = async () => [goal()];
goalsHttp.getGoal = async () => goal(transport.owner, revision);
goalsHttp.createGoal = async body => { saved.push(body); return new Promise(resolve => { finishSave = resolve; }); };
goalsHttp.updateGoal = async (_id, body) => { saved.push(body); return goal(); };
todayHttp.listLogs = async () => [{ goalId: 'goal', localDate: '2026-09-01', status: 'DONE', amount: 11 }, { goalId: 'goal', localDate: '2026-10-09', status: 'SKIPPED', amount: null }];
const host = document.getElementById('app')!;
const root = createRoot(host);
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const captures: { checking: boolean; input: string | null; owner: string | undefined; text: string }[] = [];
let current: any;
function Diagnostic() {
  const session = authClient.useSession();
  const epoch = usePrivateEpoch();
  current = { owner: session.data?.user.id, error: session.error, pending: session.isPending, refetching: session.isRefetching, epoch };
  useLayoutEffect(() => { captures.push({ owner: current.owner, checking: current.pending || current.refetching || !!current.error,
    input: host.querySelector<HTMLInputElement>('#goal-title')?.value ?? null, text: host.textContent ?? '' }); });
  return null;
}
const ensure = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
const settle = async () => { for (let i = 0; i < 15; i++) await act(tick); };
const input = () => host.querySelector<HTMLInputElement>('#goal-title');
const values = () => ({ title: input()?.value, total: host.querySelector<HTMLInputElement>('#goal-totalRequired')?.value, amount: host.querySelector<HTMLInputElement>('#goal-sessionAmount')?.value, month: host.querySelector('h1')?.textContent });
const set = async (selector: string, value: string) => act(async () => {
  const target = host.querySelector<HTMLInputElement>(selector)!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(target, value);
  target.dispatchEvent(new Event('input', { bubbles: true })); await tick();
});
const navigate = async (to: string) => { await act(async () => { void router.navigate({ to }); await tick(); }); await settle(); };
const click = async (selector: string) => act(async () => { host.querySelector<HTMLButtonElement>(selector)!.click(); await tick(); });
const realNow = Date.now; let advance = 0; let visibility = 'visible';
Date.now = () => realNow() + advance;
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
const visible = async (seconds: number) => act(async () => {
  advance += seconds * 1000; visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange'));
  visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); await tick();
});
const release = async () => { transport.hold = false; transport.held.splice(0).forEach((resolve: () => void) => resolve()); await settle(); };
async function prepare(page = 'create') {
  await act(async () => { window.dispatchEvent(new Event('online')); await tick(); }); await settle();
  const path = page === 'create' ? '/goals/new' : `/goals/goal/${page}`;
  await navigate(path); await visible(6); await settle();
  if (page === 'history') { await click('button[aria-label="前の月"]'); ensure(values().month?.includes('9月'), 'September not selected'); }
  else { ensure(input(), 'form not ready'); await set('#goal-title', 'A-PRIVATE-UX-DRAFT'); await set('#goal-totalRequired', '123'); await set('#goal-sessionAmount', '17'); input()!.focus(); }
  return path;
}
async function operation(label: string, action: (path: string) => Promise<unknown>, page = 'create') {
  const path = await prepare(page), before = values(), reads = transport.reads;
  transport.hold = true; await action(path); await settle();
  const didCheck = transport.reads > reads;
  if (didCheck) ensure(!input() && !host.querySelector('.fr-history__cal'), label + ': private DOM remained during check');
  await release(); const after = values();
  ensure(JSON.stringify(before) === JSON.stringify(after), label + ': same-owner draft/month lost');
  return { label, page, reads: transport.reads - reads, privateDomRemoved: didCheck };
}
async function run() {
  await act(async () => { root.render(<QueryClientProvider client={client}><PrivateCacheGuard /><Diagnostic /><RouterProvider router={router} /></QueryClientProvider>); await tick(); }); await settle();
  const operations = [];
  operations.push(await operation('window focus without visibility change', async () => { advance += 6000; await act(async () => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); await tick(); }); }));
  operations.push(await operation('hidden only', async () => { advance += 6000; visibility = 'hidden'; await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await tick(); }); })); visibility = 'visible';
  operations.push(await operation('visible return within 5s', () => visible(0)));
  operations.push(await operation('visible return after 6s', () => visible(6)));
  operations.push(await operation('offline only', async () => act(async () => { window.dispatchEvent(new Event('offline')); await tick(); })));
  operations.push(await operation('online within 5s', async () => act(async () => { window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('online')); await tick(); })));
  operations.push(await operation('online after 6s', async () => act(async () => { advance += 6000; window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('online')); await tick(); })));
  operations.push(await operation('same path navigation', navigate));
  operations.push(await operation('search-only navigation', path => navigate(path + '?ux=1')));
  operations.push(await operation('router invalidate', async () => { await act(async () => { void router.invalidate(); await tick(); }); }));
  operations.push(await operation('edit visible return', () => visible(6), 'edit'));
  operations.push(await operation('history visible return', () => visible(6), 'history'));
  operations.push(await operation('edit same path navigation', navigate, 'edit'));
  operations.push(await operation('history same path navigation', navigate, 'history'));
  await prepare(); await navigate('/'); ensure(!input(), 'route leave did not unmount'); await navigate('/goals/new'); ensure(input()?.value === '', 'real route leave restored old draft');
  operations.push({ label: 'public route leave and return discards draft', page: 'create', reads: 1, privateDomRemoved: true });
  const safety = [];
  await prepare(); transport.failure = '503'; await visible(6); await settle(); ensure(!input(), '503 exposed input'); transport.failure = null; await visible(6); await settle(); ensure(input()?.value === '', 'failure→A restored draft'); safety.push('503→A loses old draft');
  await prepare('edit'); const atom = authClient.$store.atoms.session!; const a = atom.get();
  await act(async () => { atom.set({ ...a, data: { ...a.data!, user: { ...a.data!.user, id: 'B' } } }); client.setQueryData(goalKeys.detail('goal'), goal('B')); atom.set(a); await tick(); }); await settle();
  ensure(input()?.value === 'A-PRIVATE-GOAL' && !host.textContent?.includes('B-PRIVATE'), 'batched A→B→A restored draft or foreign query'); safety.push('batched atom A→B→A invalidates draft and foreign query');
  await prepare('edit'); const stable = atom.get(), startedEpoch = getPrivateEpoch();
  await act(async () => { atom.set({ ...stable, isRefetching: true }); ensure(getPrivateEpoch() !== startedEpoch, 'direct GET epoch remained valid during checking'); client.setQueryData(goalKeys.detail('goal'), goal('B')); atom.set(stable); await tick(); }); await settle();
  ensure(input()?.value === 'A-PRIVATE-UX-DRAFT' && !host.textContent?.includes('B-PRIVATE'), 'batched normal confirmation lost draft or reused foreign query'); safety.push('batched normal check keeps draft but resets foreign query/direct GET epoch');
  await prepare(); const healthy = atom.get(); await act(async () => { atom.set({ ...healthy, error: { status: 429, message: 'test' } as any }); atom.set(healthy); await tick(); }); await settle(); ensure(input()?.value === '', 'batched error→A restored draft'); safety.push('batched 429→A invalidates draft');
  await prepare(); await act(async () => { authClient.$store.notify('$sessionSignal'); await tick(); }); await settle(); ensure(input()?.value === '', 'auth signal restored draft'); safety.push('auth operation signal invalidates same-owner draft');
  await prepare(); const signedIn = atom.get(); await act(async () => { atom.set({ ...signedIn, data: null }); atom.set(signedIn); await tick(); }); await settle(); ensure(input()?.value === '', 'batched signed-out→A restored draft'); safety.push('batched signed-out→A invalidates draft');
  await prepare(); await act(async () => { window.dispatchEvent(new StorageEvent('storage', { key: 'better-auth.message', newValue: JSON.stringify({ event: 'session', data: { trigger: 'signout' } }) })); await tick(); }); await settle(); ensure(input()?.value === '', 'cross-tab notification restored draft'); safety.push('cross-tab auth notification invalidates same-owner draft');
  await prepare('edit'); revision = 2; transport.hold = true; await visible(6); await settle(); await release(); ensure(input()?.value === 'A-PRIVATE-GOAL' && values().total === '100' && host.textContent?.includes('未保存の入力は復元していません'), 'changed edit revision reused old draft/baseline or had no notice'); safety.push('changed edit revision discards snapshot with notice'); revision = 1;
  await prepare('edit'); settingsRevision = 2; transport.hold = true; await visible(6); await settle(); await release(); ensure(input()?.value === 'A-PRIVATE-GOAL' && host.textContent?.includes('未保存の入力は復元していません'), 'changed settings revision reused old snapshot'); safety.push('settings revision change discards snapshot even if values match'); settingsRevision = 1;
  await prepare(); await click('button[type="submit"]'); await settle(); ensure(saved.length === 1 && input(), 'ordinary save unmounted or did not submit once'); transport.hold = true; await visible(6); await settle(); await release(); ensure(!input() && saved.length === 1, 'pending save opened a duplicate form'); finishSave!(goal()); await settle(); ensure(input()?.value === '' && saved.length === 1, 'old save callback restored or navigated input'); safety.push('in-flight save stays blocked across check; old callback cannot navigate');
  await prepare('edit'); await click('button[type="submit"]'); await settle(); ensure(saved.length === 2, 'edit did not save once'); const patch = saved[1] as any; ensure(patch.title === 'A-PRIVATE-UX-DRAFT' && patch.totalRequired === 123 && patch.sessionAmount === 17 && patch.answerRevision === undefined, 'normal restored edit produced wrong patch'); safety.push('explicit edit save uses original baseline and changed fields');
  ensure(!captures.some(c => c.checking && (c.input !== null || c.text.includes('-PRIVATE'))), 'private DOM observed while checking');
  ensure(transport.writes === 0, 'unexpected auth/private network write');
  await act(async () => root.unmount()); client.clear(); Date.now = realNow;
  return { operations, safety, writes: saved.length, observations: captures.length };
}
run().then(result => { document.getElementById('result')!.textContent = JSON.stringify({ ok: true, ...result }); }).catch(error => { document.getElementById('result')!.textContent = JSON.stringify({ ok: false, error: error.stack ?? String(error) }); });
