import assert from 'node:assert/strict';
import test from 'node:test';
import type { Goal } from '../src/contracts/goal.ts';
import { setup, signedInClient } from './helpers/stack.ts';

const NOW = new Date('2026-10-07T12:00:00Z');
const input = { title: '合成の目標', unit: 'minutes', totalRequired: 600, sessionAmount: 30, timezone: 'UTC' } as const;
const fieldPaths = (json: Record<string, unknown> | null) =>
  ((json?.error as { fields?: { path: string }[] } | undefined)?.fields ?? []).map(field => field.path).sort();

test('Goal titleのDB非対応文字を422で拒否し、回答・実ログ・保存metadataを保全する', async t => {
  const { db, stack } = await setup(t, { now: () => NOW });
  const owner = await signedInClient(stack.app, 'title-owner');
  const other = await signedInClient(stack.app, 'title-other');
  const created = await owner.call('POST', '/api/goals', { ...input, questionPrior: { a: 'LOW', b: 'HIGH' } });
  assert.equal(created.status, 201, created.body);
  const goal = created.json as unknown as Goal;
  const url = `/api/goals/${goal.id}`;
  assert.equal((await owner.call('PUT', `${url}/logs/${goal.today}`, { status: 'DONE' })).status, 200);

  // timestamp・raw・回答版・snapshotを含む全保存列を比較し、失敗したPATCHの部分適用を検出する。
  const saved = async () => ({
    goals: (await db.pool.query('select to_jsonb(g) as row from goal g order by id')).rows,
    logs: (await db.pool.query('select to_jsonb(l) as row from action_log l order by goal_id, local_date')).rows,
  });
  const before = await saved();

  await t.test('NULの位置と同じ不正要求の再送にかかわらずPOST/PATCHは422で保存しない', async () => {
    for (const title of ['\u0000', '\u0000目標', '目\u0000標', '目標\u0000', '目標\u0000\n']) {
      for (let attempt = 0; attempt < 2; attempt++) {
        for (const [method, path, body] of [
          ['POST', '/api/goals', { ...input, title }],
          ['PATCH', url, { title, totalRequired: 900, questionPrior: { a: 'MID', b: 'MID' }, expectedAnswerRevision: 0 }],
        ] as const) {
          const response = await owner.call(method, path, body);
          assert.equal(response.status, 422, `${method} ${JSON.stringify(title)}: ${response.body}`);
          assert.equal((response.json?.error as { code: string }).code, 'VALIDATION_ERROR');
          assert.deepEqual(fieldPaths(response.json), ['body/title']);
          assert.deepEqual(await saved(), before);
        }
      }
    }
  });

  await t.test('他の違反との混在でもtitleを含む全fieldsを返す', async () => {
    const invalid = { title: '目\u0000標', sessionAmount: 0, timezone: 'Mars/Olympus' };
    for (const [method, path, body] of [
      ['POST', '/api/goals', { ...input, ...invalid }],
      ['PATCH', url, invalid],
    ] as const) {
      const response = await owner.call(method, path, body);
      assert.equal(response.status, 422);
      assert.equal((response.json?.error as { code: string }).code, 'VALIDATION_ERROR');
      assert.deepEqual(fieldPaths(response.json), ['body/sessionAmount', 'body/timezone', 'body/title']);
      assert.deepEqual(await saved(), before);
    }
  });

  await t.test('他ownerの正常要求は404、後続の正常更新は回答版と実ログの規則を保つ', async () => {
    for (const [method, body] of [['GET', undefined], ['PATCH', { title: '他人の更新' }], ['DELETE', undefined]] as const) {
      const response = await other.call(method, url, body);
      assert.equal(response.status, 404);
      assert.equal((response.json?.error as { code: string }).code, 'NOT_FOUND');
      assert.deepEqual(await saved(), before);
    }
    const updated = await owner.call('PATCH', url, {
      title: '正常な更新', totalRequired: 900, questionPrior: { a: 'MID', b: 'MID' }, expectedAnswerRevision: 0,
    });
    assert.equal(updated.status, 200, updated.body);
    const r11 = await owner.call('GET', `${url}?view=r11`);
    assert.equal(r11.status, 200);
    assert.equal(r11.json?.title, '正常な更新');
    assert.equal(r11.json?.totalRequired, 900);
    assert.equal(r11.json?.answerRevision, 1);
    assert.deepEqual(r11.json?.questionPrior, { a: 'MID', b: 'MID' });
    assert.deepEqual((await saved()).logs, before.logs);
    assert.equal((await owner.call('GET', `${url}/today?view=r11`)).status, 200);
  });

  await t.test('日本語・絵文字・改行と1/100文字境界を保持し、101文字と空白のみは拒否する', async () => {
    for (const title of ['日', '😀', '日'.repeat(100), '😀'.repeat(100), '\n合成の目標\n', '目標\tの続き']) {
      const response = await owner.call('POST', '/api/goals', { ...input, title });
      assert.equal(response.status, 201, response.body);
      assert.equal(response.json?.title, title);
      const patched = await owner.call('PATCH', `/api/goals/${response.json?.id}`, { title });
      assert.equal(patched.status, 200, patched.body);
      assert.equal(patched.json?.title, title);
    }
    const boundaryBefore = await saved();
    for (const title of ['', ' \n\t ', '日'.repeat(101), '😀'.repeat(101)]) {
      for (const [method, path, body] of [
        ['POST', '/api/goals', { ...input, title }], ['PATCH', url, { title }],
      ] as const) {
        const response = await owner.call(method, path, body);
        assert.equal(response.status, 422, response.body);
        assert.deepEqual(fieldPaths(response.json), ['body/title']);
        assert.deepEqual(await saved(), boundaryBefore);
      }
    }
  });
});
