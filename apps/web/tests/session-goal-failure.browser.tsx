import { act, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { router } from '../src/router.tsx';
import { authClient } from '../src/auth/client.ts';
import { getPrivateEpoch, PrivateCacheGuard, usePrivateEpoch } from '../src/api/session-cache.ts';
import { goalKeys, goalsHttp } from '../src/api/goals-http.ts';
import { todayHttp } from '../src/api/today-http.ts';
import { ApiError } from '../src/api/client.ts';

// 実SDK・実routerと画面を使う。HTTP/event/時計だけ制御し、実認証E2Eと区別する。
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const transport = (globalThis as any).__sessionTransport;
const goal = (owner = transport.owner, revision = 1) => ({ id: 'goal', title: `${owner}-PRIVATE-GOAL`, unit: 'minutes', totalRequired: 100, sessionAmount: 10, initialProgress: 0, progressDone: 0, today: '2026-10-09', todayStatus: 'UNRECORDED', timezone: 'UTC', recordStartDate: '2026-09-01', hasLogs: false, questionPrior: { a: null, b: null }, answerRevision: revision, goalSettingsRevision: settingsRevision });
let revision = 1;
let settingsRevision = 1;
let saved: unknown[] = [];
const createWrites: { body: unknown; key: string; owner?: string }[] = [];
const recordCreate = (body: unknown, key: string, owner?: string) => { saved.push(body); createWrites.push({ body, key, owner }); };
let finishSave: ((data: any) => void) | undefined;
goalsHttp.listGoals = async () => [goal()];
goalsHttp.getGoal = async id => ({ ...goal(transport.owner, revision), id, ...(id !== 'goal' && { title: `${transport.owner}-PRIVATE-${id}` }) });
goalsHttp.createGoal = async (body, key, owner) => { recordCreate(body, key, owner); return new Promise(resolve => { finishSave = resolve; }); };
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
// #185 / D-32: 保存失敗の直後に同じ人の正常な確認が入っても、Goal作成・編集の入力・項目エラー・失敗の文脈を保つ。
// 確認中は送信できず、確認失敗・別ownerでは従来どおり捨てる。Goal APIは合成（実API・DBの結果は検査しない）。
const observe = () => ({
  path: location.pathname, ...values(),
  disabled: input()?.disabled ?? null,
  titleInvalid: input()?.getAttribute('aria-invalid') ?? null,
  actions: host.querySelector('.fr-goalform__actions')?.textContent ?? '',
  notices: host.querySelector('form')?.textContent ?? '',
  submitDisabled: host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled ?? null,
  saves: saved.length,
});
const reject = (error: unknown) => async (body: unknown, ...rest: any[]) => { saved.push(body); if (rest.length === 2) createWrites.push({ body, key: rest[0], owner: rest[1] }); throw error; };
const api = (status: number, code: string, fields?: { path: string; message: string }[]) => new ApiError(status, { error: { code, message: 'synthetic ' + code, ...(fields && { fields }) } });
const CONFLICT = 'ほかの画面で内容が変わりました', FAILED = '保存できませんでした';
type Obs = ReturnType<typeof observe>;
async function failThenCheck(page: 'create' | 'edit', error: unknown, opts: { failGetAfterCheck?: boolean; during?: (o: Obs) => Promise<void> } = {}) {
  const create = goalsHttp.createGoal, update = goalsHttp.updateGoal, get = goalsHttp.getGoal;
  if (page === 'create') goalsHttp.createGoal = reject(error) as any; else goalsHttp.updateGoal = reject(error) as any;
  await prepare(page);
  await click('button[type="submit"]'); await settle(); const failed = observe();
  transport.hold = true; await visible(6); await settle(); const during = observe();
  await opts.during?.(during);
  if (opts.failGetAfterCheck) goalsHttp.getGoal = async () => { throw api(503, 'SYNTHETIC_UNAVAILABLE'); };
  await release(); const after = observe();
  goalsHttp.createGoal = create; goalsHttp.updateGoal = update; goalsHttp.getGoal = get;
  return { failed, during, after, restore: async () => { await navigate('/goals'); sessionStorage.removeItem('future-roi:create-attempt:A'); } };
}
const kept = (o: Obs) => o.title === 'A-PRIVATE-UX-DRAFT' && o.total === '123' && o.amount === '17';
async function run() {
  await act(async () => { root.render(<QueryClientProvider client={client}><PrivateCacheGuard /><Diagnostic /><RouterProvider router={router} /></QueryClientProvider>); await tick(); }); await settle();
  const results: string[] = [];
  {
    const r = await failThenCheck('edit', api(409, 'GOAL_SETTINGS_CONFLICT'), { during: async o => {
      ensure(kept(o) && o.submitDisabled, 'edit409: form not kept or submittable while checking');
      await act(async () => { host.querySelector('form')!.requestSubmit(); await tick(); });
      ensure(saved.length === o.saves, 'edit409: submit sent while checking');
    } });
    ensure(kept(r.failed) && r.failed.actions.includes(CONFLICT) && r.failed.submitDisabled, 'edit409 fixture');
    ensure(kept(r.after) && r.after.actions.includes(CONFLICT) && r.after.submitDisabled && r.after.saves === r.failed.saves,
      'edit409: input/conflict lost or re-save allowed before latest GET: ' + JSON.stringify(r.after));
    await r.restore(); results.push('edit 409 keeps input and conflict; save stays blocked until latest GET');
  }
  {
    const r = await failThenCheck('edit', api(409, 'GOAL_SETTINGS_CONFLICT'), { failGetAfterCheck: true });
    ensure(kept(r.after) && r.after.actions.includes(CONFLICT) && r.after.submitDisabled && r.after.notices.includes('最新の内容を取得できるまで、変更は保存できません'),
      'edit409+GET503: form lost or save unblocked: ' + JSON.stringify(r.after));
    await r.restore(); results.push('edit 409 then failing latest GET keeps form, conflict and the save gate');
  }
  for (const [label, error] of [['503', api(503, 'SYNTHETIC_UNAVAILABLE')], ['network', new TypeError('synthetic offline')]] as const) {
    const r = await failThenCheck('edit', error);
    ensure(kept(r.after) && r.after.actions.includes(FAILED) && r.after.actions.includes('もう一度保存') && r.after.saves === r.failed.saves && r.after.path === '/goals/goal/edit',
      `edit ${label}: failure context lost, auto-resent or navigated: ` + JSON.stringify(r.after));
    await r.restore(); results.push(`edit ${label} keeps input and failure notice without resend`);
  }
  for (const page of ['edit', 'create'] as const) {
    const r = await failThenCheck(page, api(422, 'VALIDATION_ERROR', [{ path: 'body/title', message: 'invalid' }]));
    ensure(kept(r.after) && r.after.titleInvalid === 'true' && !r.after.disabled, `${page} 422: input or field error lost: ` + JSON.stringify(r.after));
    await r.restore(); results.push(`${page} uncorrected 422 keeps input and field error`);
  }
  {
    const r = await failThenCheck('create', api(503, 'SYNTHETIC_UNAVAILABLE'));
    ensure(kept(r.after) && r.after.disabled && r.after.actions.includes(FAILED) && r.after.saves === r.failed.saves &&
      JSON.parse(sessionStorage.getItem('future-roi:create-attempt:A') ?? '{}').body?.title === 'A-PRIVATE-UX-DRAFT', 'create 503: frozen attempt or notice lost: ' + JSON.stringify(r.after));
    await r.restore(); results.push('create 503 keeps frozen attempt and its notice');
  }
  // 境界: 確認失敗・別ownerでは、失敗中の入力を持ち越さない
  {
    const update = goalsHttp.updateGoal; goalsHttp.updateGoal = reject(api(503, 'SYNTHETIC_UNAVAILABLE')) as any;
    await prepare('edit'); await click('button[type="submit"]'); await settle();
    transport.failure = '503'; await visible(6); await settle(); ensure(!input(), 'session 503 kept private form');
    transport.failure = null; await visible(6); await settle();
    ensure(input()?.value === 'A-PRIVATE-GOAL' && !host.textContent?.includes(FAILED), 'failed check restored failed input/context');
    await prepare('edit'); await click('button[type="submit"]'); await settle();
    transport.owner = 'B'; await visible(6); await settle();
    ensure(!host.textContent?.includes('A-PRIVATE') && !host.textContent?.includes(FAILED), 'B received A failed input/context');
    transport.owner = 'A'; await visible(6); await settle();
    ensure(input()?.value === 'A-PRIVATE-GOAL' && !host.textContent?.includes(FAILED), 'A→B→A restored failed input/context');
    goalsHttp.updateGoal = update; await navigate('/goals'); results.push('session failure and A→B→A discard failed input and context');
  }
  const privateDuringFailedCheck = captures.some(c => c.checking && c.owner !== 'A' && c.text.includes('A-PRIVATE'));
  ensure(!privateDuringFailedCheck, 'A private DOM shown to non-A');
  ensure(transport.writes === 0, 'unexpected auth write');
  await act(async () => root.unmount()); client.clear(); Date.now = realNow;
  return { results, saves: saved.length };
}
run().then(result => { document.getElementById('result')!.textContent = JSON.stringify({ ok: true, ...result }); }).catch(error => { document.getElementById('result')!.textContent = JSON.stringify({ ok: false, error: error.stack ?? String(error) }); });
