import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectTestFiles } from './test-files.mjs';

// 導入済みのコンパイラを明示して使い、自動installや秘密の環境設定ファイルの参照は行わない。
const [mode, flag, compilerPath, ...extra] = process.argv.slice(2);
if (!['typecheck', 'test', 'build'].includes(mode) || extra.length ||
    (flag !== undefined && (flag !== '--tsc' || !compilerPath))) {
  throw new Error('Usage: node scripts/check.mjs typecheck|test|build [--tsc <existing typescript/bin/tsc>]');
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

// build: 型検査してdist（JSと.d.ts）を出す。apps/apiはpackageのexports経由でこのdistを読む（#77）。testも同じ出力を使う。
run([compiler, '--project', 'tsconfig.json', ...(mode === 'typecheck' ? ['--noEmit'] : [])]);
if (mode === 'test') {
  run(['--test', ...collectTestFiles(resolve(root, 'tests'))]);
}
