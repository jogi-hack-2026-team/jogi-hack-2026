import type { TSchema, Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { ApiError, toApiError } from './client.ts';

/**
 * 業務API（/api/*）を呼ぶ共通の入口。client.ts の fetchHealth と同じく、成功応答も共有契約（TypeBox）で実行時に確認し、
 * 契約と異なる形はエラーにする。失敗応答は toApiError で status を保ったまま ApiError にする。
 * 通信そのものの失敗（fetch の reject）はそのまま投げ、画面側で「通信エラー」として扱う。
 * signal を渡すと、利用者が変わったときなどに取得を中断できる（TanStack Query の queryFn が渡す signal）。
 */
type RequestInitLike = { method?: string; body?: unknown; signal?: AbortSignal | undefined };

export async function requestJson<S extends TSchema>(schema: S, path: string, init: RequestInitLike = {}): Promise<Static<S>> {
  const res = await send(path, init);
  const json: unknown = await res.json().catch(() => null);
  if (res.ok && Value.Check(schema, json)) return json;
  throw toApiError(res.status, json);
}

/** 成功時に本文のない応答（204）を返すAPI用。 */
export async function requestNoContent(path: string, init: RequestInitLike = {}): Promise<void> {
  const res = await send(path, init);
  if (res.status === 204) return;
  const json: unknown = await res.json().catch(() => null);
  throw toApiError(res.status, json);
}

function send(path: string, { method = 'GET', body, signal }: RequestInitLike): Promise<Response> {
  const init: RequestInit = { method, credentials: 'same-origin' };
  if (signal) init.signal = signal;
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return fetch(path, init);
}

/** ログインが切れている（または未ログイン）。API は 401 を返す。 */
export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** 対象がない（削除済み・他人のもの）。API は存在を明かさず 404 を返す。 */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
