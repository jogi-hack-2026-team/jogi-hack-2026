import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../src/api/client.ts';
import { classifySaveError, describeChoice, toLogPut } from '../src/features/logs/record-log.ts';

test('量を変えていないDONEは amount を送らず、APIに1回の量で補わせる。SKIPPEDは amount を送らない', () => {
  assert.deepEqual(toLogPut({ status: 'DONE', amount: null }), { status: 'DONE' });
  assert.deepEqual(toLogPut({ status: 'DONE', amount: 35 }), { status: 'DONE', amount: 35 });
  // SKIPPED に amount があると API は 422 にするため、量が残っていても送らない
  assert.deepEqual(toLogPut({ status: 'SKIPPED', amount: 35 }), { status: 'SKIPPED' });
  assert.deepEqual(toLogPut({ status: 'SKIPPED', amount: null }), { status: 'SKIPPED' });
});

test('保存できなかった記録を「やった・20分」「休んだ」と書く（量を変えていなければ1回の量）', () => {
  assert.equal(describeChoice({ status: 'DONE', amount: null }, 20, '分', '休んだ'), 'やった・20分');
  assert.equal(describeChoice({ status: 'DONE', amount: 1500 }, 20, '分', '休んだ'), 'やった・1,500分');
  assert.equal(describeChoice({ status: 'SKIPPED', amount: null }, 20, '回', '休んだ'), '休んだ');
});

test('保存の失敗を、ログイン切れ・記録できない日・それ以外（再試行できる）に分ける', () => {
  const body = (code) => ({ error: { code, message: 'x', fields: [{ path: 'params/localDate', message: 'x' }] } });
  assert.equal(classifySaveError(new ApiError(401, { error: { code: 'UNAUTHENTICATED', message: 'x' } })), 'signed-out');
  assert.equal(classifySaveError(new ApiError(422, body('LOG_DATE_OUT_OF_WINDOW'))), 'date');
  assert.equal(classifySaveError(new ApiError(422, body('LOG_DATE_BEFORE_START'))), 'date');
  assert.equal(classifySaveError(new ApiError(422, body('VALIDATION_ERROR'))), 'failed');
  assert.equal(classifySaveError(new ApiError(500, null)), 'failed');
  assert.equal(classifySaveError(new TypeError('Failed to fetch')), 'failed');
});
