import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import type { Auth } from '../src/auth/options.ts';
import { apiBoundary } from '../src/http/api-boundary.ts';
import { registerApiGuards } from '../src/http/guards.ts';

test('registered business routes determine their boundary independently of raw URL', () => {
  assert.equal(apiBoundary('/api/goals/:id', '/another-path'), 'protected');
  assert.equal(apiBoundary('/api/goals/:id', '/api/auth/example'), 'protected');
  assert.equal(apiBoundary('/api/health', '/another-path'), 'public');
  assert.equal(apiBoundary('/api/auth/*', '/another-path'), 'auth');
});

test('the real onRequest hook forwards all session response cookies to a normal business route', async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  let calls = 0;
  const auth = { api: { getSession: async (options: { returnHeaders: boolean }) => {
    assert.equal(options.returnHeaders, true);
    calls++;
    const headers = new Headers();
    headers.append('set-cookie', 'first=fixture; Path=/; HttpOnly');
    headers.append('set-cookie', 'second=fixture; Path=/; HttpOnly');
    return { response: { user: { id: 'fixture-user' } }, headers };
  } } } as unknown as Auth;
  registerApiGuards(app, auth, ['http://app.test']);
  app.get('/api/example', (request) => ({ userId: request.userId }));
  const response = await app.inject({ method: 'GET', url: '/api/example' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().userId, 'fixture-user');
  assert.equal(calls, 1);
  const cookies = response.headers['set-cookie'];
  assert.ok(Array.isArray(cookies));
  assert.deepEqual(cookies.map((cookie) => cookie.split('=')[0]), ['first', 'second']);
});

test('unregistered API paths stay protected and public exceptions require a registered route', () => {
  assert.equal(apiBoundary(undefined, '/api/goals?limit=1'), 'protected');
  assert.equal(apiBoundary(undefined, '/api/health'), 'protected');
  assert.equal(apiBoundary(undefined, '/api/auth/example'), 'protected');
  assert.equal(apiBoundary(undefined, '/api'), 'protected');
  assert.equal(apiBoundary(undefined, '/login'), 'outside');
});
