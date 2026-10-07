import assert from 'node:assert/strict';
import { test } from 'node:test';
import { focusManager, onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { fetchPolicy } from '../src/features/today/fetch-policy.ts';

// fetchPolicyを実際のTanStack Queryに渡し、場面ごとに取得をやり直すかを確かめる。
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

function setup(queryFn) {
  const client = new QueryClient();
  // QueryClientProviderと同じく、focus・reconnectの通知を受け取れるようにする
  client.mount();
  const options = { queryKey: ['today'], queryFn, ...fetchPolicy };
  const mount = () => {
    const observer = new QueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => {});
    return { observer, unsubscribe };
  };
  return { client, mount };
}

function failing() {
  let calls = 0;
  const queryFn = async () => {
    calls += 1;
    throw new Error('通信エラー');
  };
  return { queryFn, calls: () => calls };
}

test('失敗の直後はやり直さず、画面に戻ったとき（focus）もエラーのままにする', async () => {
  const api = failing();
  const { client, mount } = setup(api.queryFn);
  const { observer, unsubscribe } = mount();
  await settle();
  assert.equal(api.calls(), 1);
  assert.equal(observer.getCurrentResult().status, 'error');

  focusManager.setFocused(false);
  focusManager.setFocused(true);
  await settle();
  assert.equal(api.calls(), 1);
  assert.equal(observer.getCurrentResult().status, 'error');
  unsubscribe();
  client.clear();
  client.unmount();
});

test('開き直したとき（mount）と通信が戻ったとき（reconnect）は、失敗した取得をやり直す', async () => {
  const api = failing();
  const { client, mount } = setup(api.queryFn);
  const first = mount();
  await settle();
  first.unsubscribe();

  const second = mount();
  await settle();
  assert.equal(api.calls(), 2);

  onlineManager.setOnline(false);
  onlineManager.setOnline(true);
  await settle();
  assert.equal(api.calls(), 3);
  assert.equal(second.observer.getCurrentResult().status, 'error');
  second.unsubscribe();
  client.clear();
  client.unmount();
});

test('成功している取得は、画面に戻ったとき（focus）に最新にする', async () => {
  let calls = 0;
  const { client, mount } = setup(async () => {
    calls += 1;
    return { ok: true };
  });
  const { observer, unsubscribe } = mount();
  await settle();
  assert.equal(observer.getCurrentResult().status, 'success');

  focusManager.setFocused(false);
  focusManager.setFocused(true);
  await settle();
  assert.equal(calls, 2);
  unsubscribe();
  client.clear();
  client.unmount();
});
