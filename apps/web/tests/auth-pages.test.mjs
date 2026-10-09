import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifySession } from '../src/auth/session.ts';
import { validateAuth, waitUntil } from '../src/auth/form.ts';

test('ログインの確認は、ログイン済み・未ログイン・確認できない（通信やサーバーの失敗）の3つに分け、失敗を未ログインにしない', () => {
  assert.deepEqual(classifySession({ data: { user: { email: 'a@example.test' } }, error: null }), { kind: 'signed-in', email: 'a@example.test' });
  // API は未ログインでも 200 で session なしを返す
  assert.deepEqual(classifySession({ data: null, error: null }), { kind: 'signed-out' });
  // 502 などの失敗・応答なしは「確認できない」。ログイン画面へ送らずエラーの画面にする
  assert.deepEqual(classifySession({ data: null, error: { status: 502, statusText: 'Bad Gateway' } }), { kind: 'unreachable' });
  assert.deepEqual(classifySession(undefined), { kind: 'unreachable' });
});

test('送る前の検査：未入力と形式の誤りを項目ごとに返し、新規登録だけ8文字以上を求める', () => {
  assert.deepEqual(validateAuth('login', 'a@example.com', 'x'), {});
  assert.deepEqual(Object.keys(validateAuth('login', '', '')), ['email', 'password']);
  assert.match(validateAuth('login', 'name@example', 'secret').email, /形式/);
  assert.match(validateAuth('register', 'a@example.com', 'short').password, /8文字以上/);
  assert.deepEqual(validateAuth('register', '  a@example.com  ', 'longenough'), {});
});

test('回数制限の待ちは、再開できる時刻を分に切り上げて伝え、過ぎたら解除する', () => {
  const now = new Date(2026, 9, 8, 14, 27, 10).getTime();
  // 4分50秒後（14:32:00）→ 約5分後・14:32
  assert.deepEqual(waitUntil(now + 290_000, now), { minutes: 5, clock: '14:32' });
  // 30秒後（14:27:40）→ 約1分後・分の途中なので14:28に切り上げる
  assert.deepEqual(waitUntil(now + 30_000, now), { minutes: 1, clock: '14:28' });
  assert.equal(waitUntil(now, now), null);
});
