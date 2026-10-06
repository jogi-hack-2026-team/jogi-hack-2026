import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, fetchHealth, toApiError } from '../src/api/client.ts';

const invalidBodies = [
  {}, [], 'upstream error', 502, true, null,
  { error: null },
  { error: { code: 'FAILED' } },
  { error: { code: 'FAILED', message: 'unexpected', extra: true } },
  { error: { code: 'FAILED', message: 'unexpected' }, extra: true },
  { error: { code: 'FAILED', message: 'unexpected', fields: [{ path: 'title' }] } },
];

test('invalid error JSON preserves ApiError and HTTP status without trusting the body', () => {
  for (const json of invalidBodies) {
    const error = toApiError(502, json);
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 502);
    assert.equal(error.body, null);
    assert.equal(error.message, 'HTTP 502');
  }
});

test('valid shared error body preserves the server message and field errors', () => {
  for (const body of [
    { error: { code: 'UNAVAILABLE', message: 'Please retry' } },
    { error: { code: 'VALIDATION_ERROR', message: 'Check input', fields: [{ path: 'title', message: 'Required' }] } },
  ]) {
    const error = toApiError(422, body);
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 422);
    assert.equal(error.message, body.error.message);
    assert.deepEqual(error.body, body);
  }
});

test('fetchHealth converts invalid JSON and JSON parsing failure to the HTTP ApiError', async (t) => {
  for (const json of invalidBodies) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(json, { status: 502 }));
    await assert.rejects(fetchHealth(), error => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 502);
      assert.equal(error.body, null);
      assert.equal(error.message, 'HTTP 502');
      return true;
    });
    t.mock.restoreAll();
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('invalid JSON', { status: 503 }));
  await assert.rejects(fetchHealth(), error => error instanceof ApiError && error.status === 503 && error.body === null);
});

test('fetchHealth preserves a valid server error and returns a valid health response', async (t) => {
  const body = { error: { code: 'DB_UNAVAILABLE', message: 'Please retry later' } };
  t.mock.method(globalThis, 'fetch', async () => Response.json(body, { status: 503 }));
  await assert.rejects(fetchHealth(), error => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 503);
    assert.equal(error.message, body.error.message);
    assert.deepEqual(error.body, body);
    return true;
  });
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => Response.json({ status: 'ok', database: 'ok' }));
  assert.deepEqual(await fetchHealth(), { status: 'ok', database: 'ok' });
});
