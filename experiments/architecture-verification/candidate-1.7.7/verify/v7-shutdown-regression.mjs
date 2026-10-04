// Supporting Artifact. Normal client keep-alive; no force-exit or early socket destroy.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { rootDir, localDir } from '../src/paths.ts';
import { Report, client, goalInput } from './lib.ts';

const report=new Report('Linux shutdown regression: keep-alive, in-flight writes and repeated restart');
const owner='future-roi-84-shutdown-'+Date.now(), db=owner+'-db', app=owner+'-app', image=owner+':verification';
const url='http://127.0.0.1:3390',password=randomBytes(32).toString('hex'),secret=randomBytes(32).toString('hex');
// Give Windows -> Docker observation time to prove every request was still active.
// Three serial placeholder jobs take 6s, inside the unchanged 10s stop budget.
const predictMs=2000,writeLockSeconds=4;
mkdirSync(localDir,{recursive:true});
const envFile=join(localDir,owner+'.env'),dbFile=join(localDir,owner+'-db.env');
const sensitive=[password,secret],transcript=[],samples=[];
const clean=s=>sensitive.reduce((text,value)=>text.replaceAll(value,'<generated-secret>'),s).replaceAll(rootDir,'<candidate-package>');
async function docker(args,timeout=600000){return await new Promise((resolve,reject)=>{
 const p=spawn('docker',args,{cwd:rootDir,windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',err='';
 p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);
 const timer=setTimeout(()=>{p.kill();reject(new Error('Owned CLI timeout'));},timeout);
 p.once('error',e=>{clearTimeout(timer);reject(e);});
 p.once('close',code=>{clearTimeout(timer);transcript.push({args:args.map(clean),code,stdout:clean(out),stderr:clean(err)});code===0?resolve(out.trim()):reject(new Error('Owned Docker command failed: '+args[0]));});
});}
async function removeOwned(name){
 let label;try{label=await docker(['inspect','--format','{{index .Config.Labels "future-roi-verification"}}',name],10000);}catch{return;}
 if(label!==owner)throw new Error('Cleanup refused: unexpected owner');
 const running=await docker(['inspect','--format','{{.State.Running}}',name],10000);
 if(running==='true')await docker(['stop','--time','10',name],15000);
 await docker(['rm',name],10000);
}
async function sql(text){return await docker(['exec',db,'psql','-v','ON_ERROR_STOP=1','-U','spike','-d','future_roi_spike','-Atc',text],10000);}
function events(output){return output.split('\n').flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});}
function phaseEvents(output){return events(output).filter(e=>e.event==='shutdown-phase'||e.event==='shutdown-resource'||e.event==='shutdown-complete');}
async function start(mode){
 writeFileSync(envFile,`NODE_ENV=test\nDATABASE_URL=postgresql://spike:${password}@127.0.0.1:5432/future_roi_spike\nBETTER_AUTH_SECRET=${secret}\nBASE_URL=${url}\nSPIKE_TRUST_PROXY_HOPS=1\nSPIKE_SIGNUP_MAX=5\nSPIKE_SIGNIN_MAX=5\nSPIKE_RL_MAX=1000\nSPIKE_PREDICT_MODE=${mode}\nSPIKE_PREDICT_MS=${predictMs}\nSPIKE_WORKERS=1\nSPIKE_LOG=1\nSPIKE_SHUTDOWN_TRACE=1\n`,{mode:0o600});
 await docker(['run','-d','--name',app,'--network','container:'+db,'--label','future-roi-verification='+owner,'--env-file',envFile,image]);
 for(let i=0;i<60;i++){try{const r=await fetch(url+'/api/health');await r.arrayBuffer();if(r.status===200)return;}catch{}await sleep(250);}
 throw new Error('Owned app not ready');
}
async function stop(){
 const t=performance.now();await docker(['stop','--time','10',app],15000);
 const state=JSON.parse(await docker(['inspect','--format','{{json .State}}',app]));
 return {exit:state.ExitCode,ms:Math.round(performance.now()-t)};
}
let failed=false;
try{
 const engine=JSON.parse(await docker(['version','--format','{{json .Server}}'],15000));
 if(engine.Os!=='linux')throw new Error('Existing Linux Docker engine required');
 report.info('D-env','actual Linux Docker engine',engine);
 await docker(['build','--label','future-roi-verification='+owner,'-f','Dockerfile.verification','-t',image,'.']);
 report.info('D-image','fixed runtime image ID/bytes',await docker(['image','inspect','--format','{{json .Id}} {{json .Size}}',image]));
 writeFileSync(dbFile,`POSTGRES_USER=spike\nPOSTGRES_DB=future_roi_spike\nPOSTGRES_PASSWORD=${password}\n`,{mode:0o600});
 await docker(['run','-d','--name',db,'--label','future-roi-verification='+owner,'--env-file',dbFile,'--tmpfs','/var/lib/postgresql:rw','-p','127.0.0.1:3390:8080','postgres:18-bookworm']);
 let ready=false;for(let i=0;i<60;i++){try{await sql('select 1');ready=true;break;}catch{await sleep(250);}}if(!ready)throw new Error('Owned PG not ready');
 // Only own synthetic DB, one migration before repeated application restarts.
 writeFileSync(envFile,`DATABASE_URL=postgresql://spike:${password}@127.0.0.1:5432/future_roi_spike\nBETTER_AUTH_SECRET=${secret}\nBASE_URL=${url}\n`,{mode:0o600});
 const migration="import{createPool,createAuthPool}from'./src/pool.ts';import{createAuth}from'./src/auth.ts';import{migrate}from'./src/migrate.ts';const p=createPool({connectionString:process.env.DATABASE_URL,max:2,int8:'string'}),a=createAuthPool({connectionString:process.env.DATABASE_URL,max:2});try{await migrate(p,createAuth({pool:a,secret:process.env.BETTER_AUTH_SECRET,baseURL:process.env.BASE_URL}));}finally{await p.end();await a.end();}";
 await docker(['run','--rm','--network','container:'+db,'--label','future-roi-verification='+owner,'--env-file',envFile,image,'node','--input-type=module','--eval',migration]);
 await start('worker');
 const A=client(url,url),B=client(url,url);
 const credentials=[1,2].map(n=>({email:`u-${n}@spike.test`,password:randomBytes(24).toString('base64url'),name:'Synthetic '+n}));
 sensitive.push(...credentials.map(c=>c.password));
 const registrations=[await A.call('POST','/api/auth/sign-up/email',credentials[0]),await B.call('POST','/api/auth/sign-up/email',credentials[1])];
 sensitive.push(...A.jar.cookies.values(),...B.jar.cookies.values());
 const ga=await A.call('POST','/api/goals',goalInput('shutdown owner A')),gb=await B.call('POST','/api/goals',goalInput('shutdown owner B'));
 const today=await A.call('GET',`/api/goals/${ga.json.id}/today`),date=today.json.today;
 if(!/^[0-9a-f-]{36}$/i.test(ga.json.id)||!/^[0-9a-f-]{36}$/i.test(gb.json.id)||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Unexpected synthetic SQL key');
 await A.call('PUT',`/api/goals/${ga.json.id}/logs/${date}`,{status:'DONE',amount:30});
 await B.call('PUT',`/api/goals/${gb.json.id}/logs/${date}`,{status:'DONE',amount:7});
 report.add('D-setup','only two synthetic identities, independent goals/logs',registrations.every(r=>r.status===200)&&ga.status===201&&gb.status===201);
 const setupStop=await stop();report.add('D-setup-stop','initial HTTP keep-alive stack stops normally',setupStop.exit===0&&setupStop.ms<10000,setupStop);
 await removeOwned(app);
 let expectedAmount=30;
 const cases=[
  {name:'worker-idle',mode:'worker',todayCount:0,write:false},
  {name:'worker-active-one',mode:'worker',todayCount:1,write:false},
  {name:'worker-active-repeat',mode:'worker',todayCount:1,write:false},
  {name:'worker-active-three-and-write',mode:'worker',todayCount:3,write:true},
  {name:'worker-write-only',mode:'worker',todayCount:0,write:true},
  {name:'worker-idle-repeat',mode:'worker',todayCount:0,write:false},
  {name:'inline-idle',mode:'inline',todayCount:0,write:false},
  {name:'inline-write',mode:'inline',todayCount:0,write:true},
  {name:'inline-idle-repeat',mode:'inline',todayCount:0,write:false},
 ];
 for(const c of cases){
  await start(c.mode);
  const idles=await Promise.all(Array.from({length:10},()=>A.call('GET','/api/goals')));
  const before=await docker(['logs',app]);let lock;
  if(c.write){
   const hold=`begin; select 1 from action_log where goal_id='${ga.json.id}' and local_date='${date}' for update; select pg_sleep(${writeLockSeconds}); commit;`;
   lock=sql(hold);
   let held=false;for(let i=0;i<30;i++){if(Number(await sql("select count(*) from pg_stat_activity where datname=current_database() and wait_event='PgSleep'"))>0){held=true;break;}await sleep(25);}if(!held)throw new Error('Synthetic lock not observed');
  }
  const jobs=[];
  for(let i=0;i<c.todayCount;i++)jobs.push(A.call('GET',`/api/goals/${ga.json.id}/today`).catch(()=>({status:null,transportFailed:true})));
  if(c.write){expectedAmount++;jobs.push(A.call('PUT',`/api/goals/${ga.json.id}/logs/${date}`,{status:'DONE',amount:expectedAmount}).catch(()=>({status:null,transportFailed:true})));}
  let receipts=[];
  if(jobs.length){for(let i=0;i<30;i++){
   const output=await docker(['logs',app]);receipts=events(output.slice(before.length)).filter(e=>e.msg==='incoming request'&&(e.req?.url?.endsWith('/today')||e.req?.method==='PUT'));
   if(receipts.length===jobs.length)break;await sleep(25);
  }}
  let blocked=false;if(c.write)blocked=Number(await sql("select count(*) from pg_stat_activity where datname=current_database() and wait_event_type='Lock'"))>0;
  const stopped=await stop();const responses=await Promise.all(jobs);if(lock)await lock;
  const output=await docker(['logs',app]),ev=events(output),phases=phaseEvents(output);
  const signalIndex=ev.findIndex(e=>e.event==='shutdown-phase'&&e.phase==='app-close-start');
  const finishes=receipts.map(r=>ev.findIndex(e=>e.reqId===r.reqId&&e.msg==='request completed'));
  const signalBeforeFinish=finishes.every(i=>i>signalIndex)&&signalIndex>=0;
  const allPhases=['http-server-closed','on-close-done','app-close-done','app-pool-end-done','auth-pool-end-done'].every(p=>phases.some(e=>e.phase===p));
  const connections=Number(phases.find(e=>e.phase?.startsWith('http-connections-'))?.phase?.split('-').at(-1));
  const details={...c,predictMs,writeLockSeconds,normalClientKeepAlive:true,stopped,connections,receipts:receipts.length,responses:responses.map(r=>({status:r.status,connection:r.res?.headers.get('connection')})),signalBeforeFinish,blockedWrite:blocked,phases};
  report.add('D-'+c.name,'normal keep-alive, drain all received requests, all resources end within 10s',
   idles.every(r=>r.status===200)&&connections>0&&stopped.exit===0&&stopped.ms<10000&&allPhases&&phases.some(e=>e.event==='shutdown-complete')&&receipts.length===jobs.length&&responses.every(r=>r.status===200)&&(!jobs.length||signalBeforeFinish)&&(!c.write||blocked),details);
  const state=JSON.parse(await sql(`select json_build_object('users',(select count(*) from "user"),'goals',(select count(*) from goal),'aCount',(select count(*) from action_log where goal_id='${ga.json.id}'),'aAmount',(select amount from action_log where goal_id='${ga.json.id}' and local_date='${date}'),'bCount',(select count(*) from action_log where goal_id='${gb.json.id}'),'bAmount',(select amount from action_log where goal_id='${gb.json.id}' and local_date='${date}'))`));
  report.add('DB-'+c.name,'after shutdown committed write exact once; other owner untouched',state.users===2&&state.goals===2&&state.aCount===1&&state.aAmount===expectedAmount&&state.bCount===1&&state.bAmount===7,state);
  report.add('LOG-'+c.name,'request logs omit generated Cookie/password/DB secrets',sensitive.every(value=>!output.includes(value)));
  samples.push(details);await removeOwned(app);
 }
 report.info('D-scope','local conditions and non-goals',{node:'24.21.0',postgres:await sql('select version()'),repeatedStarts:10,cases:cases.length,clock:'server-generated local date, synthetic data',http1:true,cloud:false,realEngine:false,headerAlreadySentStreamAndWebSocket:false});
}catch(e){failed=true;report.add('D-execution','shutdown matrix completes',false,{message:e.message});}
finally{
 for(const name of [app,db]){try{await removeOwned(name);}catch(e){failed=true;report.add('D-cleanup-'+name,'owned resource cleanup',false,{message:e.message});}}
 for(const f of [envFile,dbFile])try{unlinkSync(f);}catch{}
 try{if(await docker(['image','inspect','--format','{{index .Config.Labels "future-roi-verification"}}',image],10000)===owner)await docker(['image','rm',image],10000);}catch{}
 mkdirSync(join(rootDir,'results/post-fix'),{recursive:true});writeFileSync(join(rootDir,'results/post-fix/v7-shutdown-transcript.json'),JSON.stringify(transcript,null,2)+'\n');
 const summary=report.save('v7-shutdown-regression.json',{samples});console.log(JSON.stringify(summary));process.exit(failed||summary.fail?1:0);
}
