import assert from 'node:assert/strict';
import test from 'node:test';
import { runAuthAction } from '../src/auth/action.ts';

for (const [name, action, successful] of [
  ['success', async () => ({ error: null }), true],
  ['API error', async () => ({ error: { code: 'UNAVAILABLE', message: 'retry' } }), false],
  ['network rejection', async () => { throw new TypeError('offline'); }, false],
]) {
  test(`auth action releases busy and only navigates on ${name}`, async () => {
    const busy = [];
    const failures = [];
    let navigations = 0;
    await runAuthAction(action, {
      setBusy: (value) => busy.push(value),
      onError: (error) => failures.push(error),
      onSuccess: async () => { navigations++; },
    });
    assert.deepEqual(busy, [true, false]);
    assert.equal(navigations, successful ? 1 : 0);
    assert.equal(failures.length, successful ? 0 : 1);
    if (name === 'network rejection') assert.equal(failures[0].code, 'NETWORK_ERROR');
  });
}
