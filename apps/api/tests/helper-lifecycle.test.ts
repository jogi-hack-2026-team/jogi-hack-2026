
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import test from 'node:test';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import { cleanupAfterFailure, cleanupAll, closeOnce } from './helpers/cleanup.ts';
import { Client } from './helpers/stack.ts';
const run = promisify(execFile);

test('全cleanupを試行し初期化エラーと複数終了エラーを保持する', async () => {
  const initial = new Error('initial'), first = new Error('first'), last = new Error('last');
  const attempts: string[] = [];
  const close = closeOnce(() => cleanupAll([
    async () => { attempts.push('first'); throw first; },
    async () => { attempts.push('middle'); },
    async () => { attempts.push('last'); throw last; },
  ]));
  await assert.rejects(cleanupAfterFailure(initial, close), (error: AggregateError) => {
    assert.equal(error.cause, initial);
    assert.deepEqual(error.errors, [initial, first, last]);
    return true;
  });
  await assert.rejects(close(), AggregateError);
  assert.deepEqual(attempts, ['first', 'middle', 'last']);
  await assert.rejects(cleanupAfterFailure(initial, async () => {}), (error) => error === initial);
});

test('表示済みGoal補完とexact要求を区別し互換入口も負例を変更しない', async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  const received: Array<{ method: string; body: unknown; key: unknown }> = [];
  const handler = (request: import('fastify').FastifyRequest) => {
    received.push({ method: request.method, body: request.body, key: request.headers['idempotency-key'] });
    return { id: 'goal', goalSettingsRevision: 7, sessionAmount: 23 };
  };
  app.all('/api/goals/:id', handler);
  app.post('/api/goals', handler);
  const client = new Client(app, null);
  await client.call('GET', '/api/goals/goal');
  await client.callWithDisplayedGoal('PUT', '/api/goals/goal', { status: 'DONE' });
  await client.sendExact('PUT', '/api/goals/goal', { status: 'DONE' });
  await client.rawCall('PATCH', '/api/goals/goal', { expectedGoalSettingsRevision: 2 });
  await client.callWithDisplayedGoal('POST', '/api/goals', {}, { 'idempotency-key': 'same-key' });
  await client.sendExact('POST', '/api/goals', {});
  assert.deepEqual(received, [
    { method: 'GET', body: undefined, key: undefined },
    { method: 'PUT', body: { expectedGoalSettingsRevision: 7, amount: 23, status: 'DONE' }, key: undefined },
    { method: 'PUT', body: { status: 'DONE' }, key: undefined },
    { method: 'PATCH', body: { expectedGoalSettingsRevision: 2 }, key: undefined },
    { method: 'POST', body: {}, key: 'same-key' },
    { method: 'POST', body: {}, key: undefined },
  ]);
});

// DATABASE_URLを子の環境だけから除き、実embedded clusterを各ケースが専有する。
// timeoutは失敗。成功markerだけでなくstdio closeと子の自然終了まで待つ。
async function runOwned(group: string) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^DATABASE_URL$/i.test(key)));
  const fixture = fileURLToPath(new URL('./helpers/lifecycle-failures.mjs', import.meta.url));
  const { stdout } = await run(process.execPath, [fixture, group], { env, windowsHide: true, timeout: 120_000 });
  assert.deepEqual(JSON.parse(stdout.trim()), { scenarios: group === 'embedded-start' ? 1 : 4 });
}

test('実合成DBでCREATE・pool構築・pool終了失敗後も所有clusterを終了する', () => runOwned('database'));
test('実app/auth pool/DBの起動途中と複数close失敗で全cleanupを保持する', () => runOwned('stack'));

test('実embedded server起動後の初期化拒否でも所有PIDを残さない', () => runOwned('embedded-start'));
