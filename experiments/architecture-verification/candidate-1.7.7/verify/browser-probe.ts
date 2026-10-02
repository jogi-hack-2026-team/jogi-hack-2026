// Real, installed Chrome with a NEW isolated profile; no existing browser/profile.
// CDP stores only URLs, methods, statuses, Cookie presence and attributes, never values.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { localDir } from '../src/paths.ts';

type Trace = { id: string; method?: string; url?: string; status?: number; cookie?: boolean; blockedReasons?: string[] };
export async function browserProbe(target: string, credentials: { email: string; password: string }, serverTrace: { method: string; path: string; cookiePresent: boolean }[]) {
  const executable = process.env.SPIKE_CHROME_PATH ?? join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe');
  if (!existsSync(executable)) return { unavailable: 'Existing Chrome executable absent', checks: [] };
  const fixtures = [createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Isolated Origin probe</title>synthetic test'); }),
    createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Isolated cross-site probe</title>synthetic test'); })];
  const origins = ['http://127.0.0.1:3291', 'http://127.0.0.2:3292'];
  let child: ReturnType<typeof spawn> | undefined;
  let ws: WebSocket | undefined;
  const trace = new Map<string, Trace>();
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  let id = 0;
  const checks: { name: string; pass: boolean; detail: unknown }[] = [];
  const call = (method: string, params: Record<string, unknown> = {}): Promise<any> => new Promise((resolve, reject) => {
    const key = ++id;
    const timer = setTimeout(() => { pending.delete(key); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(key, { resolve, reject, timer }); ws!.send(JSON.stringify({ id: key, method, params }));
  });
  try {
    // Refuse a pre-existing debugger listener; never attach to another browser.
    const portProbe = createServer();
    await new Promise<void>((resolve, reject) => { portProbe.once('error', () => reject(new Error('Isolated CDP port is already in use'))); portProbe.listen(3299, '127.0.0.1', resolve); });
    await new Promise<void>(resolve => portProbe.close(() => resolve()));
    for (let n = 0; n < fixtures.length; n++) await new Promise<void>(resolve => fixtures[n].listen(3291 + n, n ? '127.0.0.2' : '127.0.0.1', resolve));
    child = spawn(executable, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
      '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=3299', `--user-data-dir=${join(localDir, 'chrome-probe-' + Date.now())}`, 'about:blank'],
      { stdio: 'ignore', windowsHide: true });
    let pages: any[] = [];
    for (let n = 0; n < 100; n++) {
      try { pages = await (await fetch('http://127.0.0.1:3299/json/list')).json() as any[]; if (pages.some(p => p.type === 'page')) break; } catch { /* startup */ }
      if (child.exitCode !== null) throw new Error('Owned Chrome exited before CDP was ready');
      await sleep(100);
    }
    const page = pages.find(p => p.type === 'page');
    if (!page?.webSocketDebuggerUrl) throw new Error('No owned headless page');
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => { ws!.onopen = () => resolve(); ws!.onerror = () => reject(new Error('Owned CDP connection failed')); });
    ws.onmessage = event => {
      const m = JSON.parse(String(event.data));
      if (m.id) { const p = pending.get(m.id); if (p) { clearTimeout(p.timer); pending.delete(m.id); m.error ? p.reject(new Error('CDP command failed')) : p.resolve(m.result); } return; }
      const p = m.params;
      if (!p?.requestId) return;
      const t: Trace = trace.get(p.requestId) ?? { id: p.requestId };
      if (m.method === 'Network.requestWillBeSent') { t.method = p.request.method; t.url = p.request.url; }
      if (m.method === 'Network.requestWillBeSentExtraInfo') {
        t.cookie = Object.keys(p.headers).some(k => k.toLowerCase() === 'cookie');
        t.blockedReasons = (p.associatedCookies ?? []).flatMap((c: any) => c.blockedReasons ?? []);
      }
      if (m.method === 'Network.responseReceived') t.status = p.response.status;
      // CORS can make a response unreadable to JS while the network got 403.
      if (m.method === 'Network.responseReceivedExtraInfo') t.status = p.statusCode;
      trace.set(p.requestId, t);
    };
    await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
    const browser = await call('Browser.getVersion');
    const navigate = async (url: string) => {
      await call('Page.navigate', { url });
      for (let n = 0; n < 100; n++) {
        const r = await call('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
        if (r.result?.value?.startsWith(url)) { await sleep(100); return; } await sleep(50);
      } throw new Error('Owned page navigation incomplete');
    };
    const evaluate = async (expression: string) => {
      const r = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('Browser evaluation failed (expression omitted)');
      return r.result?.value;
    };
    await navigate(target + '/api/health');
    const login = await evaluate(`fetch('/api/auth/sign-in/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify(credentials)})}).then(r=>r.status)`);
    checks.push({ name: 'real browser same-origin auth login', pass: login === 200, detail: { status: login } });
    const jar = await call('Network.getCookies', { urls: [target] });
    const shapes = jar.cookies.map((c: any) => ({ name: c.name, httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite, path: c.path }));
    checks.push({ name: 'real browser stores HttpOnly Lax session cookie on local HTTP', pass: shapes.some((c: any) => c.name.endsWith('session_token') && c.httpOnly && c.sameSite === 'Lax' && c.path === '/'), detail: shapes });
    const positive = await evaluate(`fetch('/api/goals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'browser positive synthetic',unit:'minutes',totalRequired:6000,sessionAmount:30,initialProgress:0,timezone:'Asia/Tokyo'})}).then(r=>r.status)`);
    checks.push({ name: 'real browser same-origin JSON mutation succeeds', pass: positive === 201, detail: { status: positive } });
    for (let n = 0; n < origins.length; n++) {
      const label = n ? 'cross-site' : 'same-site distinct port';
      await navigate(origins[n]); trace.clear(); serverTrace.length = 0;
      const jsonFailed = await evaluate(`fetch(${JSON.stringify(target + '/api/goals')},{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:'{}'}).then(()=>false).catch(()=>true)`);
      await sleep(250);
      let rows = [...trace.values()].filter(t => t.url?.startsWith(target + '/api/goals'));
      const received = serverTrace.filter(t => t.path === '/api/goals').map(t => ({ ...t }));
      checks.push({ name: `${label} JSON preflight blocks mutation`, pass: jsonFailed === true && rows.some(t => t.method === 'OPTIONS' && (t.status ?? 0) >= 400) && received.some(t => t.method === 'OPTIONS') && !received.some(t => t.method === 'POST'), detail: { fetchRejected: jsonFailed, requests: rows, serverReceived: received,
        note: 'Chrome can emit a provisional requestWillBeSent POST before preflight; server receipt distinguishes actual wire delivery.' } });
      // A simple request has no JSON preflight; Origin guard must reject it itself.
      trace.clear();
      const simpleFailed = await evaluate(`fetch(${JSON.stringify(target + '/api/goals')},{method:'POST',credentials:'include',headers:{'Content-Type':'text/plain'},body:'{}'}).then(()=>false).catch(()=>true)`);
      await sleep(250); rows = [...trace.values()].filter(t => t.url?.startsWith(target + '/api/goals'));
      const simplePost = rows.find(t => t.method === 'POST');
      checks.push({ name: `${label} simple fetch POST rejected before parsing`, pass: simpleFailed === true && simplePost?.status === 403 && simplePost.cookie === !n, detail: { fetchRejected: simpleFailed, requests: rows } });
      trace.clear();
      await evaluate(`(()=>{const f=document.createElement('form');f.method='POST';f.action=${JSON.stringify(target + '/api/goals')};document.body.append(f);f.submit();return true})()`);
      for (let j = 0; j < 100; j++) { if ([...trace.values()].some(t => t.url?.startsWith(target + '/api/goals') && t.method === 'POST' && t.status)) break; await sleep(50); }
      rows = [...trace.values()].filter(t => t.url?.startsWith(target + '/api/goals'));
      const form = rows.find(t => t.method === 'POST');
      checks.push({ name: `${label} browser form POST rejected`, pass: form?.status === 403 && form.cookie === !n, detail: { requests: rows } });
    }
    return { browser: browser.product, browserTest: true, localHttpOnly: true, checks };
  } finally {
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('Owned browser closing')); } pending.clear();
    if (ws?.readyState === WebSocket.OPEN) { try { await call('Browser.close'); } catch { /* owned process fallback */ } }
    ws?.close();
    if (child && child.exitCode === null) { await sleep(250); if (child.exitCode === null) child.kill(); }
    for (const server of fixtures) if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
  }
}
