import { authClient } from './client.ts';

/**
 * 画面を開く前のログインの確認結果。
 * - signed-in：ログインしている
 * - signed-out：ログインしていない（API は 200 で session なしを返す）
 * - unreachable：確認できなかった（通信の失敗・API の 5xx など）。未ログインと取り違えてログイン画面へ送らない
 */
export type SessionCheck = { kind: 'signed-in'; email: string } | { kind: 'signed-out' } | { kind: 'unreachable' };

type SessionResult = { data?: { user?: { email?: string | null } | null } | null; error?: unknown } | null | undefined;

/** getSession の結果を3つに分ける。投げた例外（通信の失敗）は呼ぶ側で unreachable にする。 */
export function classifySession(result: SessionResult): SessionCheck {
  if (!result || result.error) return { kind: 'unreachable' };
  const user = result.data?.user;
  return user ? { kind: 'signed-in', email: user.email ?? '' } : { kind: 'signed-out' };
}

export async function checkSession(): Promise<SessionCheck> {
  try {
    return classifySession(await authClient.getSession());
  } catch {
    return { kind: 'unreachable' };
  }
}

/** ログインを確認できなかった（通信の失敗）。ルートのエラー画面で「接続できませんでした」として扱う。 */
export class SessionUnreachableError extends Error {
  constructor() {
    super('ログインの状態を確認できませんでした。');
    this.name = 'SessionUnreachableError';
  }
}
