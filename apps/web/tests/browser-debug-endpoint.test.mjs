import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDevToolsEndpoint, parseDevToolsActivePort } from './browser-debug-endpoint.mjs';

test('Chrome debug endpoint: authoritative stderr works without a profile metadata file', () => {
  // Linux launcher/sandboxのprofile namespaceをNode側から読めなくても、owned Chromeのendpointが根拠になる。
  const stderr = '[Chrome startup diagnostic]\nDevTools listening on ws://127.0.0.1:43123/devtools/browser/owned-browser\n';
  assert.equal(parseDevToolsEndpoint(stderr), 'ws://127.0.0.1:43123/devtools/browser/owned-browser');
  assert.equal(parseDevToolsActivePort(''), null);
});
test('Chrome debug endpoint: split startup line completes after the next stderr chunk', () => {
  const first = 'startup\nDevTools listening on ws://127.0.0.1:';
  assert.equal(parseDevToolsEndpoint(first + '43123/devtools/browser/partial'), null);
  assert.equal(parseDevToolsEndpoint(first), null);
  assert.equal(parseDevToolsEndpoint(first + '43123/devtools/browser/owned-browser\n'), 'ws://127.0.0.1:43123/devtools/browser/owned-browser');
});
test('Chrome debug endpoint: unrelated logs and incomplete announcement are not readiness', () => {
  for (const stderr of ['', 'DevTools listening', 'DevTools listening on ws://127.0.0.1:43123/devtools/browser/']) {
    assert.equal(parseDevToolsEndpoint(stderr), null);
  }
});
test('Chrome debug endpoint: only credential-free loopback browser endpoints are accepted', () => {
  for (const endpoint of [
    'ws://example.invalid:43123/devtools/browser/x', 'ws://127.0.0.1:0/devtools/browser/x',
    'ws://user:password@127.0.0.1:43123/devtools/browser/x', 'ws://127.0.0.1:43123/devtools/page/x',
    'ws://127.0.0.1:43123/devtools/browser/x?query=1', 'ws://127.0.0.1:43123/devtools/browser/x#fragment',
  ]) assert.equal(parseDevToolsEndpoint('DevTools listening on ' + endpoint + '\n'), null);
  assert.equal(parseDevToolsEndpoint('DevTools listening on ws://[::1]:43123/devtools/browser/x\n'), 'ws://[::1]:43123/devtools/browser/x');
});
test('Chrome debug endpoint: profile fallback accepts native LF and CRLF files', () => {
  for (const newline of ['\n', '\r\n']) {
    assert.equal(parseDevToolsActivePort('43123' + newline + '/devtools/browser/owned-browser' + newline), 'ws://127.0.0.1:43123/devtools/browser/owned-browser');
  }
});
test('Chrome debug endpoint: malformed or partial profile files never become an endpoint', () => {
  for (const contents of ['', '43123', 'not-a-port\n/devtools/browser/x', '65536\n/devtools/browser/x', '43123\n/devtools/page/x']) {
    assert.equal(parseDevToolsActivePort(contents), null);
  }
});
