import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';

// 導入済みのコンパイラを明示して使い、自動installや秘密の環境設定ファイルの参照は行わない。
const [mode, flag, compilerPath, ...extra] = process.argv.slice(2);
if (!['typecheck', 'test'].includes(mode) || extra.length ||
    (flag !== undefined && (flag !== '--tsc' || !compilerPath))) {
  throw new Error('Usage: node scripts/check.mjs typecheck|test [--tsc <existing typescript/bin/tsc>]');
}
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
let compiler;
try {
  compiler = compilerPath ? resolve(compilerPath) : require.resolve('typescript/bin/tsc');
} catch {
  throw new Error('Existing TypeScript compiler required. Pass --tsc <path>; no installation is performed.');
}

function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run([compiler, '--project', 'tsconfig.json', ...(mode === 'typecheck' ? ['--noEmit'] : [])]);
if (mode === 'test') {
  const tests = readdirSync(resolve(root, 'tests')).filter(name => name.endsWith('.test.mjs'));
  run(['--test', ...tests.map(name => `tests/${name}`)]);
}
