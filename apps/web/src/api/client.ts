import { Value } from '@sinclair/typebox/value';
import { Health, type ErrorBody } from '@contracts';

export class ApiError extends Error {
  readonly status: number;
  readonly body: ErrorBody | null;
  constructor(status: number, body: ErrorBody | null) {
    super(body?.error.message ?? `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

// 応答は共有契約で実行時にも確認し、契約と異なる形はエラーとして扱う。
export async function fetchHealth(): Promise<Health> {
  const res = await fetch('/api/health', { credentials: 'same-origin' });
  const json: unknown = await res.json().catch(() => null);
  if (Value.Check(Health, json)) return json;
  throw new ApiError(res.status, json as ErrorBody | null);
}
