import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

// 既存 Vite/React だけで bundle し、Chromium の実DOMで hook を検査する。新しいテスト依存は不要。
// CI ubuntu-latest の Chrome、Windows の既存 Chrome/Edge、または明示した TEST_BROWSER を使う。
async function browserPath() {
  const candidates = [process.env.TEST_BROWSER,
    ...(process.platform === 'win32' ? [
      join(process.env.PROGRAMFILES ?? 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
      join(process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
    ] : process.platform === 'darwin' ? [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ] : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'])].filter(Boolean);
  for (const path of candidates) { try { await access(path); return path; } catch {} }
  throw new Error('Chromium not found: set TEST_BROWSER to an installed Chrome/Edge/Chromium executable (not a skipped PASS)');
}

test('session ownership: real React hooks/Goal screens reject old cache and drafts in every DOM commit', { timeout: 60000 }, async (t) => {
  const browser = await browserPath();
  const dir = await mkdtemp(join(tmpdir(), 'futureroi-session-test-'));
  t.after(() => {
    if (!dir.startsWith(join(tmpdir(), 'futureroi-session-test-'))) throw new Error('refusing cleanup outside test temp directory');
    return rm(dir, { recursive: true, force: true });
  });
  const bundle = await build({
    configFile: false, logLevel: 'silent',
    resolve: { alias: { '@contracts': fileURLToPath(new URL('../../api/src/contracts/index.ts', import.meta.url)), '@tanstack/react-router': 'test:router' }, conditions: ['development'] },
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [react(), {
      name: 'isolated-test-router',
      enforce: 'pre',
      resolveId: (id) => id === 'test:router' ? '\0test:router' : id.endsWith('/auth/client.ts') ? '\0test:auth' : null,
      load: (id) => id === '\0test:auth' ? 'export const authClient = {};' : id === '\0test:router' ? `import {createElement} from 'react';
        export const Link=({to,params,search,children,...props})=>createElement('a',{href:to,...props},children);
        export const useNavigate=()=>()=>{}; export const useLocation=()=>({href:'/goals'});` : null,
    }],
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./session-cache.browser.tsx', import.meta.url)), formats: ['iife'], name: 'SessionTests' } },
  });
  const outputs = (Array.isArray(bundle) ? bundle : [bundle]).flatMap((b) => b.output);
  const code = outputs.filter((out) => out.type === 'chunk').map((out) => out.code).join('\n');
  const page = join(dir, 'index.html');
  await writeFile(page, `<div id="app"></div><pre id="result">PENDING</pre><script>
    onerror=(message)=>{document.getElementById('result').textContent=JSON.stringify({ok:false,error:String(message)});};
    onunhandledrejection=(event)=>{document.getElementById('result').textContent=JSON.stringify({ok:false,error:String(event.reason)});};
    </script><script>${code.replaceAll('</script', '<\\/script')}</script>`);
  const { stdout, stderr } = await promisify(execFile)(browser, [
    '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${join(dir, 'profile')}`, '--dump-dom', '--virtual-time-budget=15000', pathToFileURL(page).href,
  ], { timeout: 45000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
  const text = stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
  assert.ok(text && text !== 'PENDING', `browser did not finish hook regression: ${stderr.slice(-1500)}`);
  const result = JSON.parse(text.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"'));
  assert.equal(result.ok, true, result.error);
  assert.equal(result.results.length, 8);
  assert.equal(result.writes, 0);
  t.diagnostic(JSON.stringify(result));
});
