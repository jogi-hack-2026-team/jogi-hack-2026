import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// hostのenv・DB・時計を計算へ渡さず、既存の検証入口を順番に実行する。
const root = fileURLToPath(new URL('../', import.meta.url));
const evidence = '/tmp/prediction-verification';
mkdirSync(evidence, { recursive: true });
console.log(`Node ${process.version}; 検証用コンテナ（製品runtimeの採択ではない）`);

function run(args, output) {
  const result = spawnSync(process.execPath, args, {
    cwd: root, shell: false, encoding: 'utf8',
    stdio: output ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
  // T-14が失敗しても計測JSONを残し、終了コードは成功へ置き換えない。
  if (output && result.stdout) writeFileSync(`${evidence}/${output}`, result.stdout);
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (output) console.log(`保存: ${evidence}/${output}`);
}

run(['node_modules/typescript/bin/tsc', '--version']);
run(['scripts/check.mjs', 'typecheck']);
run(['scripts/check.mjs', 'test']);
run(['examples/recalculate.mjs'], 'connection.json');
run(['scripts/benchmark.mjs'], 't14.json');
console.log('PASS: 型検査・数値テスト・接続例・実Engine T-14');
