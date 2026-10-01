// Supporting Artifact / Not a Source of Truth (Issue #84).
import pg from 'pg';

const INT8_OID = 20;

// node-postgres returns int8 as a string by default. Better Auth 1.7.6 stores
// "rateLimit"."lastRequest" as int8 and computes lastRequest + window * 1000 for X-Retry-After;
// with a string that is a concatenation, so the header becomes ~1.8e14 seconds.
function int8AsNumber(value: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new RangeError(`int8 value is outside the safe integer range: ${value}`);
  return n;
}

/** `int8: 'string'` is the node-postgres default; `'number'` is the fix verified by verify/v1-rate-limit.ts. */
export function createPool(o: { connectionString: string; max: number; int8: 'string' | 'number' }) {
  if (o.int8 === 'string') return new pg.Pool({ connectionString: o.connectionString, max: o.max });
  const getTypeParser = ((oid: number, format?: 'text' | 'binary') =>
    oid === INT8_OID && format !== 'binary' ? int8AsNumber : pg.types.getTypeParser(oid, format as 'text')) as typeof pg.types.getTypeParser;
  return new pg.Pool({ connectionString: o.connectionString, max: o.max, types: { getTypeParser } });
}
