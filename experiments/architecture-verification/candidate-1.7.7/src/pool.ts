// Supporting Artifact / Not a Source of Truth (Issue #84).
import pg from 'pg';

const INT8_OID = 20;

// node-postgres returns int8 as a string by default. Better Auth 1.7.6/1.7.7 stores
// "rateLimit"."lastRequest" as int8 and computes lastRequest + window * 1000 for X-Retry-After;
// with a string that is a concatenation, so the header becomes ~1.8e14 seconds.
function int8AsNumber(value: string): number {
  if (!/^-?\d+$/.test(value)) throw new RangeError('Expected an int8 decimal integer.');
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new RangeError(`int8 value is outside the safe integer range: ${value}`);
  return n;
}

/** Dedicated auth pool only. Every TEXT-format OID 20 result in this pool is
 * converted, not just lastRequest. Safe range: [-9007199254740991,9007199254740991].
 * No global pg.types mutation; app/admin pools and other OIDs are unchanged.
 * Binary int8 is not used by this Kysely path and retains pg's default parser.
 * legacyString is an explicit fault-injection control, never the normal default.
 */
export function createAuthPool(o: { connectionString: string; max: number; legacyString?: boolean }) {
  return createPool({ ...o, int8: o.legacyString ? 'string' : 'number' });
}

/** `int8: 'string'` is the node-postgres default; `'number'` is the fix verified by verify/v1-rate-limit.ts. */
export function createPool(o: { connectionString: string; max: number; int8: 'string' | 'number' }) {
  if (o.int8 === 'string') return new pg.Pool({ connectionString: o.connectionString, max: o.max });
  const getTypeParser = ((oid: number, format?: 'text' | 'binary') =>
    oid === INT8_OID && format !== 'binary' ? int8AsNumber : pg.types.getTypeParser(oid, format as 'text')) as typeof pg.types.getTypeParser;
  return new pg.Pool({ connectionString: o.connectionString, max: o.max, types: { getTypeParser } });
}
