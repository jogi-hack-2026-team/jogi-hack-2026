import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { isSaveFor, saveLogKey } from '../src/features/logs/useSaveLog.ts';
import { ApiError } from '../src/api/client.ts';
import { choiceFromLog, classifySaveError, describeChoice, toLogPut, yesterdayRecord } from '../src/features/logs/record-log.ts';

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

test('昨日は、記録開始日より前なら何も出さず、未記録なら補完、記録済みなら訂正の対象にする', () => {
  const logs = [
    { localDate: '2026-10-06', status: 'DONE', amount: 20 },
    { localDate: '2026-10-07', status: 'SKIPPED', amount: null },
  ];
  assert.deepEqual(yesterdayRecord('2026-10-06', '2026-10-07', logs), { kind: 'before-start' });
  assert.deepEqual(yesterdayRecord('2026-10-05', '2026-10-01', logs), { kind: 'missing' });
  assert.deepEqual(yesterdayRecord('2026-10-06', '2026-10-01', logs), { kind: 'recorded', log: logs[0] });
  // 開始日の当日は記録できる
  assert.deepEqual(yesterdayRecord('2026-10-06', '2026-10-06', logs), { kind: 'recorded', log: logs[0] });
});

test('訂正の初期値は保存済みの記録（DONEは保存済みの量のまま、今の1回の量に置き換えない）', () => {
  assert.deepEqual(choiceFromLog({ localDate: '2026-10-06', status: 'DONE', amount: 20 }), { status: 'DONE', amount: 20 });
  assert.deepEqual(choiceFromLog({ localDate: '2026-10-06', status: 'SKIPPED', amount: null }), { status: 'SKIPPED', amount: null });
  // 保存済みの量で要約する（1回の量が30分に変わっていても「20分」）
  assert.equal(describeChoice(choiceFromLog({ localDate: '2026-10-06', status: 'DONE', amount: 20 }), 30, '分', '休んだ'), 'やった・20分');
});
test('作り直す前の画面の保存が終わるまで、新しい画面から同じ日の保存は送らない（別の日は送れる）', async () => {
  const client = new QueryClient();
  let finish;
  // 一覧へ戻る前の画面で始めた、今日の「やった」の保存（まだ届いていない）
  const before = new MutationObserver(client, { mutationKey: saveLogKey('g'), mutationFn: () => new Promise((r) => (finish = r)) });
  const pending = before.mutate({ localDate: '2026-10-07', choice: { status: 'DONE', amount: null } }).catch(() => {});
  while (!finish) await new Promise((r) => setTimeout(r, 1));

  // 開き直した新しい画面（useSaveLog の save と同じ確かめ方）
  const busy = (localDate) => client.isMutating({ mutationKey: saveLogKey('g'), predicate: (m) => isSaveFor(localDate, m.state.variables) }) > 0;
  assert.equal(busy('2026-10-07'), true);
  assert.equal(busy('2026-10-06'), false);
  assert.equal(client.isMutating({ mutationKey: saveLogKey('other'), predicate: (m) => isSaveFor('2026-10-07', m.state.variables) }), 0);

  finish({ localDate: '2026-10-07', status: 'DONE', amount: 20 });
  await pending;
  assert.equal(busy('2026-10-07'), false);
  client.clear();
});