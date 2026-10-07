import assert from 'node:assert/strict';
import test from 'node:test';
import { MigrationChecksumError } from '../src/db/migrate.ts';
import { startupFailureMessage } from '../src/startup-error.ts';

test('起動失敗は既知の原因だけを分類し、外部の例外属性を出さない', () => {
  const secret = 'synthetic-password-must-not-appear';
  for (const [code, reason] of [['ECONNREFUSED', 'db_connection'], ['08P01', 'db_connection'],
    ['28P01', 'db_authentication'], ['42501', 'db_permission'], [secret, 'unknown'], ['toString', 'unknown']]) {
    const error = Object.assign(new Error(`postgres://user:${secret}@db/private`), {
      code, name: secret, detail: secret, stack: secret,
    });
    const message = startupFailureMessage('migration', error);
    assert.ok(message.startsWith(`startup: migration failed (${reason})`));
    assert.ok(!message.includes(secret));
    assert.ok(!message.includes('postgres://'));
  }
});

test('checksum不一致を型で分類し、configuration/server/未知の失敗は固定文面にする', () => {
  const secret = 'synthetic-migration-name-must-not-appear';
  const checksum = startupFailureMessage('migration', new MigrationChecksumError(secret));
  assert.ok(checksum.startsWith('startup: migration failed (checksum_mismatch)'));
  assert.ok(!checksum.includes(secret));
  assert.ok(startupFailureMessage('configuration', new Error(secret)).includes('(invalid_configuration)'));
  for (const error of [undefined, null, secret, 42, new Error(secret), { code: 42 }, { code: 'checksum_mismatch' }]) {
    assert.ok(startupFailureMessage('migration', error).includes('(unknown)'));
    assert.ok(!startupFailureMessage('server', error).includes(secret));
  }
});
