import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { candidate, dependencies, compiler, existingRequire, requireSetup, project } from './runtime.mjs';
requireSetup();
function run(args,env=process.env) {
  const result=spawnSync(process.execPath,args,{cwd:candidate,env,encoding:'utf8',windowsHide:true});
  process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
  if(result.status!==0)throw new Error(`Verification failed (exit ${result.status}).`);
}
const versions={node:process.version,typescript:JSON.parse(readFileSync(join(compiler,'../../package.json'),'utf8')).version,
  react:existingRequire('react/package.json').version,reactDom:existingRequire('react-dom/package.json').version,
  vite:JSON.parse(readFileSync(join(dependencies,'vite/package.json'),'utf8')).version};
console.log(JSON.stringify({verificationOnly:true,versions}));
const cjs=join(candidate,'.qa/cjs');
run([compiler,'--project',project('CommonJS',cjs)]);
run(['--test','tests/presentation.test.cjs'],{...process.env,NODE_PATH:dependencies,UI_CANDIDATE_BUILD:cjs});
run([compiler,'--project',project('ESNext',join(candidate,'.qa/esm'))]);
// Build this isolated preview only; no auth/API/server from the dependency experiment.
const { build }=await import(pathToFileURL(existingRequire.resolve('vite')).href);
await build({configFile:false,root:candidate,base:'./',resolve:{alias:{react:join(dependencies,'react'),'react-dom':join(dependencies,'react-dom')}},
  build:{outDir:join(candidate,'.qa/web'),emptyOutDir:false}});
console.log('PASS: strict candidate types, SSR tests and isolated React preview build.');
