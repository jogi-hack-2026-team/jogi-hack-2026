import { MigrationChecksumError } from './db/migrate.ts';

export type StartupPhase = 'configuration' | 'migration' | 'server';

// 外部例外のname/message/detail等を出さず、既知codeを固定の分類へ変換する。
const dbFailures = new Map([
  ...['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', 'EAI_AGAIN',
    '08000', '08001', '08003', '08004', '08006', '08007', '08P01'].map(code => [code, 'db_connection'] as const),
  ['28P01', 'db_authentication'], ['28000', 'db_authentication'], ['42501', 'db_permission'],
]);

export function startupFailureMessage(phase: StartupPhase, error: unknown): string {
  let reason = phase === 'configuration' ? 'invalid_configuration' : 'unknown';
  if (phase === 'migration') {
    if (error instanceof MigrationChecksumError) reason = 'checksum_mismatch';
    else if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
      reason = dbFailures.get(error.code) ?? 'unknown';
    }
  }
  return `startup: ${phase} failed (${reason}); check configuration, DB availability and migration history. API was not started.`;
}
