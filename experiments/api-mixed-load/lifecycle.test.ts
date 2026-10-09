import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import test from 'node:test';
import { distinctLoopbackPorts, monitorChild, withHarnessCleanup, type Stop } from './lifecycle.ts';

async function listenerChild() {
  const child = spawn(process.execPath, ['-e', `
    require('node:http').createServer((req,res)=>res.end('fixture'))
      .listen(0,'127.0.0.1',function(){ process.send({port:this.address().port}); });
  `], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], windowsHide: true });
  const lifecycle = monitorChild(child, 1_000);
  try {
    const [message] = await once(child, 'message', { signal: AbortSignal.timeout(10_000) }) as [{ port: number }];
    return { child, lifecycle, port: message.port };
  } catch (error) {
    await lifecycle.stop();
    throw error;
  }
}

async function portReleased(port: number) {
  const probe = createServer();
  try {
    probe.listen(port, '127.0.0.1');
    await once(probe, 'listening', { signal: AbortSignal.timeout(5_000) });
  } finally {
    if (probe.listening) await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  }
}

test('2つのloopback portは異なり、選択用listenerも閉じる', async () => {
  const [first, second] = await distinctLoopbackPorts();
  assert.notEqual(first, second);
  await portReleased(first);
  await portReleased(second);
});

test('DB取得後のmigration失敗でもDB closeを1回行い、元の例外を保持する', async () => {
  let closed = 0;
  const original = new Error('fixture migration failure');
  await assert.rejects(withHarnessCleanup([], async () => { closed++; }, async () => { throw original; }), error => error === original);
  assert.equal(closed, 1);
});

for (const phase of ['startup-readiness', 'seed', 'wiring', 'scenario', 'result-write']) {
  test(`${phase}の例外で実childが終了し、DB closeはその後に呼ばれる`, async t => {
    const { child, lifecycle, port } = await listenerChild();
    t.after(() => lifecycle.stop());
    const original = new Error(`fixture ${phase} failure`);
    let closed = 0;
    await assert.rejects(withHarnessCleanup([lifecycle.stop], async () => {
      assert.ok(child.exitCode !== null || child.signalCode !== null, 'database cleanup follows confirmed child exit');
      await portReleased(port);
      closed++;
    }, async () => { throw original; }), error => error === original);
    assert.equal(closed, 1);
    await lifecycle.stop(); // 既に終了したchildへ再stopしても待ち続けない。
  });
}

test('stopが失敗しても残りのchildとDB closeを試み、元の例外も報告する', async () => {
  const events: string[] = [];
  const original = new Error('fixture work failure'), stopError = new Error('fixture stop failure'), dbError = new Error('fixture DB close failure');
  const stops: Stop[] = [async () => { events.push('child-a'); }, async () => { events.push('child-b'); throw stopError; }];
  await assert.rejects(withHarnessCleanup(stops, async () => { events.push('db'); throw dbError; }, async () => { throw original; }), (error: unknown) => {
    assert(error instanceof AggregateError);
    assert.deepEqual(error.errors, [original, stopError, dbError]);
    return true;
  });
  assert.deepEqual(events, ['child-b', 'child-a', 'db']);
});

test('正常終了でもchild→DBの順でcleanupし、戻り値を保持する', async () => {
  const events: string[] = [];
  assert.equal(await withHarnessCleanup([async () => { events.push('child'); }], async () => { events.push('db'); }, async () => 42), 42);
  assert.deepEqual(events, ['child', 'db']);
});

test('spawn失敗は未処理errorにならず、stopが完了する', async () => {
  const child = spawn('futureroi-mixed-load-nonexistent-fixture-executable', [], { stdio: 'ignore', windowsHide: true });
  const lifecycle = monitorChild(child, 1_000);
  await once(child, 'close', { signal: AbortSignal.timeout(5_000) }).catch(error => {
    assert.equal((error as NodeJS.ErrnoException).code, 'ENOENT');
  });
  assert.equal(await lifecycle.stop(), null);
  assert.equal((lifecycle.spawnError() as NodeJS.ErrnoException).code, 'ENOENT');
});

test('監視開始前に終了済みのchildでもstopが完了する', async () => {
  const child = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore', windowsHide: true });
  await once(child, 'exit', { signal: AbortSignal.timeout(5_000) });
  assert.equal(await monitorChild(child, 1_000).stop(), 0);
});

test('spawn後のerrorだけで終了済みと誤認しない', async t => {
  const { child, lifecycle, port } = await listenerChild();
  t.after(() => lifecycle.stop());
  child.emit('error', new Error('synthetic post-spawn signal error'));
  assert.equal(lifecycle.spawnError(), undefined);
  assert.equal(child.exitCode, null);
  assert.equal(child.signalCode, null);
  await lifecycle.stop();
  assert.ok(child.exitCode !== null || child.signalCode !== null);
  await portReleased(port);
});
