import type { ErrorBody } from '../contracts/index.ts';

export function errorBody(code: string, message: string, fields?: ErrorBody['error']['fields']): ErrorBody {
  return { error: fields ? { code, message, fields } : { code, message } };
}
