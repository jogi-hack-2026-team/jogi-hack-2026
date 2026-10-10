import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { parseDevToolsEndpoint, parseDevToolsActivePort } from './browser-debug-endpoint.mjs';

// 既存Vite/React + Node24標準WebSocketのみ。実viewport/native入力を使い、matchMediaやclickをmockしない。
async function browserPath() {
  const candidates = [process.env.TEST_BROWSER, ...(process.platform === 'win32' ? [
    join(process.env.PROGRAMFILES ?? 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
  ] : process.platform === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ] : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'])].filter(Boolean);
  for (const path of candidates) { try { await access(path); return path; } catch {} }
  throw new Error('Chromium not found: set TEST_BROWSER to an installed Chrome/Edge/Chromium executable (not a skipped PASS)');
}
async function until(read, accept, message, timeout = 10000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) { value = await read(); if (accept(value)) return value; await delay(20); }
  throw new Error(message + ': ' + JSON.stringify(value));
}
async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true });
  });
  const pending = new Map();
  let id = 0;
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data)), command = pending.get(message.id);
    if (!command) return;
    pending.delete(message.id); clearTimeout(command.timer);
    if (message.error) command.reject(new Error(JSON.stringify(message.error))); else command.resolve(message.result);
  });
  socket.addEventListener('close', () => {
    for (const command of pending.values()) { clearTimeout(command.timer); command.reject(new Error('CDP socket closed')); }
    pending.clear();
  });
  return { socket, send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const commandId = ++id;
      const timer = setTimeout(() => { pending.delete(commandId); reject(new Error('CDP timeout: ' + method)); }, 10000);
      pending.set(commandId, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: commandId, method, params }));
    });
  } };
}

test('Today responsive details: real viewport, native keyboard and preserved user choice', { timeout: 180000 }, async (t) => {
  const browser = await browserPath(), dir = await mkdtemp(join(tmpdir(), 'futureroi-responsive-details-'));
  let server, child, cdp, exited;
  t.after(async () => {
    if (cdp) { await cdp.send('Browser.close').catch(() => {}); cdp.socket.close(); }
    if (child && child.exitCode === null && child.signalCode === null) child.kill();
    if (exited) await exited;
    if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
    if (!dir.startsWith(join(tmpdir(), 'futureroi-responsive-details-'))) throw new Error('refusing cleanup outside test temp directory');
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  });
  const bundle = await build({
    configFile: false, logLevel: 'silent', define: { 'process.env.NODE_ENV': '"development"' }, plugins: [react()],
    build: { write: false, minify: false, lib: {
      entry: fileURLToPath(new URL('./responsive-details.browser.tsx', import.meta.url)), formats: ['iife'], name: 'ResponsiveDetailsTests',
    } },
  });
  const code = (Array.isArray(bundle) ? bundle : [bundle]).flatMap(b => b.output)
    .filter(out => out.type === 'chunk').map(out => out.code).join('\n');
  const html = '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div><script>'
    + code.replaceAll('</script', '<\\/script') + '</script>';
  server = createServer((_, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  child = spawn(browser, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', '--user-data-dir=' + join(dir, 'profile'), 'about:blank'],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '', stderrEndpoint = null, endpointSource = null, activePortError = null, launchError = null;
  const diagnostics = () => JSON.stringify({ browser, profile: join(dir, 'profile'),
    exitCode: child.exitCode, signalCode: child.signalCode, launchError,
    activePortReadError: activePortError, stderr });
  child.stderr.on('data', chunk => {
    const combined = stderr + chunk;
    stderrEndpoint ??= parseDevToolsEndpoint(combined);
    stderr = combined.slice(-4000);
  });
  exited = new Promise(resolve => {
    child.once('exit', resolve);
    child.once('error', error => { launchError = { code: error.code, message: error.message.slice(0, 400) }; resolve(); });
  });
  let endpoint;
  try {
    endpoint = await until(async () => {
      if (launchError || child.exitCode !== null || child.signalCode !== null) throw new Error('Chrome exited: ' + diagnostics());
      // Chrome自身がstderrへ報告するendpointは、launcherのprofile namespaceに依存しない。
      if (stderrEndpoint) { endpointSource = 'stderr'; return stderrEndpoint; }
      try {
        const contents = await readFile(join(dir, 'profile', 'DevToolsActivePort'), 'utf8');
        const fromProfile = parseDevToolsActivePort(contents);
        if (fromProfile) { endpointSource = 'profile'; return fromProfile; }
        activePortError = { code: 'INVALID_CONTENT', message: contents.slice(0, 256) };
      } catch (error) { activePortError = { code: error.code, message: error.message.slice(0, 400) }; }
      return null;
    }, value => !!value, 'Chrome debug endpoint unavailable');
  } catch (error) { throw new Error('Chrome debug endpoint unavailable: ' + diagnostics(), { cause: error }); }
  const debugOrigin = new URL(endpoint);
  debugOrigin.protocol = 'http:';
  const target = await until(async () => (await (await fetch(new URL('/json/list', debugOrigin))).json())
    .find(page => page.type === 'page'), value => !!value?.webSocketDebuggerUrl, 'Chrome page unavailable');
  cdp = await connect(target.webSocketDebuggerUrl);
  const evaluate = async expression => {
    const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const view = () => evaluate('window.__responsiveFixture?.view()');
  const resize = async width => {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await until(view, value => value?.width === width && value.desktop === (width >= 960), 'viewport/media did not update');
  };
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url });
  await until(view, value => !!value, 'React fixture did not mount');
  const state = async (open, message) => {
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const value = await until(view, value => value?.open === open && value.contentVisible === open, message);
    assert.equal(value.open, open, message); assert.equal(value.contentVisible, open, message);
    return value;
  };
  const fresh = async width => {
    await resize(width); await evaluate('window.__responsiveFixture.mountDetails()');
    return state(width >= 960, 'fresh initial open state');
  };
  const click = async () => {
    const { x, y } = await evaluate('(() => { const r=document.querySelector("summary").getBoundingClientRect(); return {x:r.x+Math.min(30,r.width/2),y:r.y+r.height/2}; })()');
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  };
  const press = async (key, code, windowsVirtualKeyCode) => {
    // Enterはtextを伴うkeyDownでnative keypress/default actionまで送る。rawKeyDownだけではsummaryが作動しない。
    await cdp.send('Input.dispatchKeyEvent', { type: key === 'Enter' ? 'keyDown' : 'rawKeyDown', key, code, windowsVirtualKeyCode,
      ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode });
  };
  const evidence = [];
  await t.test('fresh 959 closes / 960 opens and untouched details follow the media boundary', async () => {
    await fresh(959);
    for (const width of [960, 959, 1440, 320]) {
      await resize(width); evidence.push({ scenario: 'untouched', ...(await state(width >= 960, 'untouched width ' + width)) });
    }
    await fresh(960); await fresh(390);
  });
  await t.test('native click closes desktop and subsequent mobile/desktop resize keeps it closed', async () => {
    await fresh(960); await click(); await state(false, 'desktop click must close');
    for (const width of [959, 1440, 320, 960]) { await resize(width); await state(false, 'explicit closed at ' + width); }
    const value = await view(); assert.ok(value.inputs.some(event => event.type === 'click' && event.trusted));
    evidence.push({ scenario: 'explicit desktop closed', ...value });
  });
  await t.test('native click opens mobile and desktop/mobile resize keeps it open', async () => {
    await fresh(390); await click(); await state(true, 'mobile click must open');
    for (const width of [960, 1440, 320, 959]) { await resize(width); await state(true, 'explicit open at ' + width); }
    evidence.push({ scenario: 'explicit mobile open', ...(await view()) });
  });
  await t.test('Tab reaches native summary, Enter toggles and explicit closed survives resize', async () => {
    await fresh(390); await evaluate('document.activeElement?.blur()'); await press('Tab', 'Tab', 9);
    assert.equal((await view()).focusedSummary, true, 'native summary must receive keyboard focus');
    await press('Enter', 'Enter', 13); await state(true, 'Enter opens');
    await press('Enter', 'Enter', 13); await state(false, 'Enter closes');
    await resize(1440); const value = await state(false, 'keyboard choice survives desktop');
    assert.ok(value.inputs.some(event => event.type === 'keydown' && event.key === 'Enter' && event.trusted));
    assert.equal(value.focusedSummary, true, 'resize must preserve summary focus');
    evidence.push({ scenario: 'native Enter', ...value });
  });
  await t.test('native Space toggles desktop and preserves the chosen open state across boundaries', async () => {
    await fresh(960); await evaluate('document.querySelector("summary").focus()');
    await press(' ', 'Space', 32); await state(false, 'Space closes');
    await press(' ', 'Space', 32); await state(true, 'Space opens');
    for (const width of [959, 320, 1440]) { await resize(width); await state(true, 'Space open survives at ' + width); }
    const value = await view(); assert.ok(value.inputs.some(event => event.type === 'keyup' && event.key === ' ' && event.trusted));
    evidence.push({ scenario: 'native Space', ...value });
  });
  await t.test('actual cumulative quantity stays exact while percent/remaining cap at the goal', async () => {
    const cases = [
      { unit: 'sessions', done: 125, total: 100, percent: '100%', amount: '累計 125回', balances: { '目標量': '100回', '残り': '0回', '目標を超えた量': '25回' } },
      { unit: 'sessions', done: 100, total: 100, percent: '100%', amount: '累計 100回', balances: { '目標量': '100回', '残り': '0回' } },
      { unit: 'sessions', done: 99, total: 100, percent: '99%', amount: '累計 99回', balances: { '目標量': '100回', '残り': '1回' } },
      { unit: 'sessions', done: 999, total: 1000, percent: '99%', amount: '累計 999回', balances: { '目標量': '1,000回', '残り': '1回' } },
      { unit: 'minutes', done: 125, total: 100, percent: '100%', amount: '累計 2時間5分', balances: { '目標量': '1時間40分', '残り': '0時間0分', '目標を超えた量': '0時間25分' } },
      { unit: 'minutes', done: 100, total: 100, percent: '100%', amount: '累計 1時間40分', balances: { '目標量': '1時間40分', '残り': '0時間0分' } },
      { unit: 'minutes', done: 25, total: 100, percent: '25%', amount: '累計 0時間25分', balances: { '目標量': '1時間40分', '残り': '1時間15分' } },
    ];
    for (const expected of cases) {
      await evaluate('window.__responsiveFixture.mountProgress(' + JSON.stringify(expected.unit) + ',' + expected.done + ',' + expected.total + ')');
      const value = await until(view, value => value?.amount === expected.amount, 'progress did not mount');
      assert.equal(value.amount, expected.amount); assert.equal(value.percent, expected.percent);
      assert.equal(value.ariaPercent, expected.percent.replace('%', '')); assert.deepEqual(value.balances, expected.balances);
      evidence.push({ scenario: 'actual quantity', unit: expected.unit, done: expected.done, total: expected.total, amount: value.amount, percent: value.percent, balances: value.balances });
    }
  });
  t.diagnostic(JSON.stringify({ browserEndpointSource: endpointSource, results: evidence }));
});
