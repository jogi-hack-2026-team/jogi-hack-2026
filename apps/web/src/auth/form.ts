import { authCopy } from '../copy/app.ts';

export type AuthMode = 'login' | 'register';
export type AuthFieldErrors = { email?: string; password?: string };

/** 送る前の検査（デザイン A2）。ログインはパスワードの有無だけ、新規登録は 8 文字以上も確かめる（API と同じ下限）。 */
export function validateAuth(mode: AuthMode, email: string, password: string): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const trimmed = email.trim();
  if (trimmed === '') errors.email = authCopy.emailRequired;
  // 形式は「@ の前後に文字があり、後ろに . を含む」だけを見る。細かい判定はサーバーに任せる
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) errors.email = authCopy.emailInvalid;
  if (password === '') errors.password = authCopy.passwordRequired;
  else if (mode === 'register' && password.length < 8) errors.password = authCopy.passwordShort;
  return errors;
}

/** 回数制限の待ち（デザイン A4）。再開できる時刻を「約○分後（HH:MMごろ）」で伝える。 */
export function waitUntil(retryAt: number, now: number): { minutes: number; clock: string } | null {
  if (retryAt <= now) return null;
  const minutes = Math.max(1, Math.ceil((retryAt - now) / 60_000));
  // 「○時○分から」と伝えるので、分の途中なら次の分に切り上げる（伝えた時刻より前に再開できることはあっても、後にはならない）
  const at = new Date(Math.ceil(retryAt / 60_000) * 60_000);
  const clock = `${at.getHours()}:${String(at.getMinutes()).padStart(2, '0')}`;
  return { minutes, clock };
}
