// Local connection verification, explicitly requiring separately reviewed checkouts.
// No network, install, API, persistence or writes to the Engine checkout.
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { candidate, compiler, dependencies, requireSetup } from './runtime.mjs';
const args=process.argv.slice(2);
if(args.length!==4 || args[0]!=='--engine-root' || args[2]!=='--fixtures') {
  throw new Error('Usage: node scripts/check-connection.mjs --engine-root <PR119 checkout> --fixtures <PR118 common-fixtures.json>');
}
requireSetup();
const engineRoot=resolve(args[1]), fixtureFile=resolve(args[3]);
const engine=join(engineRoot,'packages/prediction'), cjs=join(candidate,'.qa/cjs'), qa=join(candidate,'.qa/connection');
if(!existsSync(join(cjs,'examples/engine-view.js'))) throw new Error('Run this candidate scripts/check.mjs first.');
function run(command,argv,env=process.env) {
  const result=spawnSync(command,argv,{cwd:candidate,env,encoding:'utf8',windowsHide:true});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`Connection verification failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}
const head=run('git',['-c',`safe.directory=${engineRoot}`,'-C',engineRoot,'rev-parse','HEAD']).trim();
const expectedHead='f7a6c02ec402d3c74fae953cac769de06b31050b';
if(head!==expectedHead)throw new Error('Review a new Engine HEAD before changing this pinned connection check.');
const changes=run('git',['-c',`safe.directory=${engineRoot}`,'-C',engineRoot,'status',
  '--porcelain','--untracked-files=all','--','packages/prediction']).trim();
if(changes)throw new Error('Use a clean Engine checkout so the reported HEAD identifies the tested source.');
mkdirSync(qa,{recursive:true});
// Typecheck original Engine module semantics, then emit to ignored UI QA only.
run(process.execPath,[compiler,'--project',join(engine,'tsconfig.json'),'--noEmit']);
const engineBuild=join(qa,'engine');
run(process.execPath,[compiler,'--project',join(engine,'tsconfig.json'),'--outDir',engineBuild,
  '--module','CommonJS','--moduleResolution','Node','--verbatimModuleSyntax','false']);
const typeLink=join(qa,'type-link.ts');
writeFileSync(typeLink,`import type { QuestionPriorAdapterResultCandidate } from ${JSON.stringify(join(engine,'src/question-prior-adapter-candidate').replaceAll('\\','/'))};\nimport { engineViewExample } from ${JSON.stringify(join(candidate,'examples/engine-view').replaceAll('\\','/'))};\ndeclare const actual: QuestionPriorAdapterResultCandidate;\nengineViewExample(actual,{unit:'minutes',sessionAmount:15,formatCompletionDays:d=>String(d)});\n`);
run(process.execPath,[compiler,'--noEmit','--strict','--target','ES2022','--module','CommonJS',
  '--moduleResolution','Node','--types','react','--typeRoots',join(dependencies,'@types'),typeLink]);
const content=readFileSync(fixtureFile), document=JSON.parse(content);
// Match Git's LF blob across Windows autocrlf and Linux checkouts.
const fixturesSha256=createHash('sha256').update(content.toString('utf8').replaceAll('\r\n','\n')).digest('hex');
if(fixturesSha256!=='ba7820aeee75d6c2e02fa8c3510fc63c9cef2a524918c5e6077abd6921b4ac47') {
  throw new Error('Review a new PR118 shared fixture before changing this pinned connection check.');
}
if(document.calculationExamples?.length!==18)throw new Error('Expected the PR118 shared 18 cases.');
const env={...process.env,NODE_PATH:dependencies,UI_CANDIDATE_BUILD:cjs,UI_ENGINE_BUILD:engineBuild,
  UI_CONNECTION_FIXTURES:fixtureFile,UI_CONNECTION_EVIDENCE:join(qa,'results.json')};
// Node 24 may default to the spec reporter; evidence counting requires TAP.
const output=run(process.execPath,['--test','--test-reporter=tap','tests/engine-connection.test.cjs'],env);
process.stdout.write(output);
const connectionTests=Number(output.match(/^# tests (\d+)$/m)?.[1]);
if(!Number.isSafeInteger(connectionTests) || connectionTests<1)throw new Error('Missing Node test summary.');
const report={status:'LOCAL CANDIDATE CONNECTION ONLY; NOT ADOPTED',engineHead:head,
  fixturesSha256,fixturesRawSha256:createHash('sha256').update(content).digest('hex'),
  node:process.version,verifiedAt:new Date().toISOString(),connectionTests,
  ...JSON.parse(readFileSync(env.UI_CONNECTION_EVIDENCE,'utf8')),
  originalEngineTypecheck:true,actualEngineToUiTypeLink:true,httpOrDbExecuted:false,savingImplemented:false};
writeFileSync(join(qa,'report.json'),JSON.stringify(report,null,2)+'\n');
const {cases,...summary}=report;
console.log(JSON.stringify(summary));
