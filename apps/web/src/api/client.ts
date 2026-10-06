import { Value } from '@sinclair/typebox/value';
import { ErrorBody, Health } from '@contracts';

export class ApiError extends Error {
  readonly status: number;
  readonly body: ErrorBody | null;
  constructor(status: number, body: ErrorBody | null) {
    super(body?.error.message ?? `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

// 失敗応答のJSONも共有契約で確認する。契約と異なる形（空object・配列・文字列など）はbodyなしのHTTPエラーにし、
// statusを失わない。
export function toApiError(status: number, json: unknown): ApiError {
  return new ApiError(status, Value.Check(ErrorBody, json) ? json : null);
}

// 応答は共有契約で実行時にも確認し、契約と異なる形はエラーとして扱う。
export async function fetchHealth(): Promise<Health> {
  const res = await fetch('/api/health', { credentials: 'same-origin' });
  const json: unknown = await res.json().catch(() => null);
  if (Value.Check(Health, json)) return json;
  throw toApiError(res.status, json);
}
