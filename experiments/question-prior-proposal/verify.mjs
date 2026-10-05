// Capture native UTF-8 buffers directly; PowerShell code-page conversion cannot corrupt logs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const tsc = process.argv[2];
if (!tsc || !fs.existsSync(tsc)) throw Error('Pass an existing TypeScript compiler path. No install is performed.');
function check(name, args, cwd = root) {
  const result = spawnSync(process.execPath, args, { cwd, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  fs.writeFileSync(new URL(`./results/${name}.out`, import.meta.url), Buffer.concat([result.stdout ?? Buffer.alloc(0), result.stderr ?? Buffer.alloc(0)]));
  if (result.error || result.status !== 0) throw Error(`${name} failed: ${result.error?.message ?? `exit ${result.status}`}; see results/${name}.out`);
  console.log(`PASS: ${name} (exit 0)`);
}
check('prototype-test', ['--test', '--test-reporter=tap', 'test/prototype.test.mjs']);
check('typecheck', [tsc, '--noEmit', '-p', 'tsconfig.json']);
check('analysis', ['analyze.mjs']);
check('bgq-boundary', ['historical/reference/bgq-boundary-check.mjs']);
check('dp-regression', ['historical/reference/dp-truncation-check.mjs']);
// Restore the byte-identical original README only in an isolated temporary reproduction.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jogi-prior-580-'));
fs.mkdirSync(path.join(temp, 'results'));
fs.copyFileSync(new URL('./historical/run.mjs', import.meta.url), path.join(temp, 'run.mjs'));
fs.cpSync(new URL('./historical/reference/', import.meta.url), path.join(temp, 'reference'), { recursive: true, filter: source => !source.endsWith('README.original.txt') });
fs.copyFileSync(new URL('./historical/reference/README.original.txt', import.meta.url), path.join(temp, 'reference/README.md'));
check('historical580-reproduced', [path.join(temp, 'run.mjs')], temp);
const results = new URL('./results/reproduced-580/results/', import.meta.url);
fs.mkdirSync(results, { recursive: true });
for (const name of ['raw.json', 'summary.json']) fs.copyFileSync(path.join(temp, 'results', name), new URL(name, results));
check('provenance', ['provenance-check.mjs']);
check('root-review', ['ROOT_REVIEW_CHECKS.mjs']);
console.log('PASS: all local checks; source artifact and historical numerical data unchanged.');
