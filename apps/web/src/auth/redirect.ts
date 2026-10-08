/** ログイン画面を開いた理由。expired は「ログインの有効期限が切れました」を出す（デザイン A5）。 */
export type AuthReason = 'expired';

export type AuthSearch = { redirect: string; reason?: AuthReason };

/** アプリ内の戻り先か（外部URL・`//host` を戻り先にしない）。 */
function isAppPath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
}

/** 明示されたアプリ内の戻り先を保ち、指定がなければGoal一覧を開く。理由は既知の値だけを残す。 */
export function authSearch(search: Record<string, unknown>): AuthSearch {
  const redirect = isAppPath(search.redirect) ? search.redirect : '/goals';
  return search.reason === 'expired' ? { redirect, reason: 'expired' } : { redirect };
}
