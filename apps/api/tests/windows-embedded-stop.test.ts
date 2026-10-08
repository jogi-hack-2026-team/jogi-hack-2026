import assert from 'node:assert/strict';
import test from 'node:test';
import { createWindowsEmbeddedStop } from './helpers/windows-embedded-stop.ts';

test('Windows合成clusterの停止は遅延し、同時要求と終了後の再要求を1回の完了へまとめる', async () => {
  let calls = 0;
  let finish!: () => void;
  const completion = new Promise<void>((resolve) => { finish = resolve; });
  const stop = createWindowsEmbeddedStop('synthetic-pg-ctl', 'synthetic-owned-cluster', async () => {
    calls++;
    await completion;
  });
  assert.equal(calls, 0, '初期化時は停止しない');
  const first = stop();
  assert.equal(stop(), first, '同時要求は同じ停止Promiseを待つ');
  await Promise.resolve();
  assert.equal(calls, 1);
  finish();
  await first;
  assert.equal(stop(), first, '終了hookによる再要求でも別の停止を実行しない');
  assert.equal(calls, 1);
});

for (const [name, fields] of [
  ['nonzero', { code: 1 }],
  ['timeout', { killed: true, signal: 'SIGTERM' }],
] as const) {
  test(`Windows合成clusterの停止${name}を失敗として保持し、再要求で成功化しない`, async () => {
    const failure = Object.assign(new Error(`synthetic ${name}`), fields);
    let calls = 0;
    const stop = createWindowsEmbeddedStop('synthetic-pg-ctl', 'synthetic-owned-cluster', async () => {
      calls++;
      throw failure;
    });
    const first = stop();
    assert.equal(stop(), first);
    await assert.rejects(first, (error) => error === failure);
    assert.equal(stop(), first);
    await assert.rejects(stop(), (error) => error === failure);
    assert.equal(calls, 1);
  });
}
