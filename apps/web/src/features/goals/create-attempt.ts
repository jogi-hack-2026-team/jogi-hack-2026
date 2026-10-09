import { GoalCreate as GoalCreateSchema, type GoalCreate } from '@contracts';
import { FormatRegistry } from '@sinclair/typebox';
import { isValidTimezone } from './goal-form.ts';
import { Value } from '@sinclair/typebox/value';

export type CreateAttempt = { owner: string; key: string; body: GoalCreate };
export type AttemptStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
// GoalCreateのcustom formatをFEの同じtimezone検証で登録する。
FormatRegistry.Set('iana-timezone', isValidTimezone);
const storageKey = (owner: string) => `future-roi:create-attempt:${owner}`;
// 一般の下書きではなく「送信済みかもしれない作成操作」。token/passwordは保存しない。
export function loadCreateAttempt(owner: string, storage: AttemptStorage): CreateAttempt | null {
  const text = storage.getItem(storageKey(owner));
  if (text === null) return null;
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object') throw new Error('作成の回復情報を読めません。');
  const attempt = value as CreateAttempt;
  if (attempt.owner !== owner || typeof attempt.key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attempt.key) || !Value.Check(GoalCreateSchema, attempt.body)) throw new Error('作成の回復情報を読めません。');
  return attempt;
}
export function prepareCreateAttempt(owner: string, body: GoalCreate, storage: AttemptStorage, key: () => string = () => crypto.randomUUID()): CreateAttempt {
  const previous = loadCreateAttempt(owner, storage);
  if (previous) return previous;
  const attempt = { owner, key: key(), body: JSON.parse(JSON.stringify(body)) as GoalCreate };
  // 永続化できない場合は送らない。応答不明後に新しいkeyで増殖させないため。
  storage.setItem(storageKey(owner), JSON.stringify(attempt));
  return attempt;
}
// 離脱した旧フォームの遅延応答が、同ownerの次の作成操作を消さない。
export function clearCreateAttempt(owner: string, key: string, storage: AttemptStorage): void {
  if (loadCreateAttempt(owner, storage)?.key === key) storage.removeItem(storageKey(owner));
}
