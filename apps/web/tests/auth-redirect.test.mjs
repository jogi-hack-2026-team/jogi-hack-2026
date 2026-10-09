import assert from 'node:assert/strict';
import test from 'node:test';
import { authSearch } from '../src/auth/redirect.ts';

test('戻り先なしの登録・ログインはGoal一覧へ進み、アプリ内の明示した戻り先はそのまま保つ', () => {
  assert.deepEqual(authSearch({}), { redirect: '/goals' });
  for (const redirect of ['/', '/goals', '/goals/new', '/goals/goal-id?view=r11#today']) {
    assert.deepEqual(authSearch({ redirect }), { redirect });
  }
});

test('外部URLや戻り先の型違反は認証後の転送先にせずGoal一覧へ進む', () => {
  for (const redirect of ['https://example.test', '//example.test', '', null, 42]) {
    assert.deepEqual(authSearch({ redirect }), { redirect: '/goals' });
  }
});

test('ログイン切れで来たときの理由（expired）だけを残し、知らない値は捨てる', () => {
  assert.deepEqual(authSearch({ redirect: '/goals/x', reason: 'expired' }), { redirect: '/goals/x', reason: 'expired' });
  assert.deepEqual(authSearch({ reason: 'other' }), { redirect: '/goals' });
});
