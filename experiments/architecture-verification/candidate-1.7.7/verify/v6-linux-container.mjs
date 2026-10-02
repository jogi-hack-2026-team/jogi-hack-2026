// Supporting Artifact. Only OWN containers; no host volumes, existing DB or cloud.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { rootDir, localDir } from '../src/paths.ts';
import { Report, client, goalInput } from './lib.ts';

const report=new Report('local Linux Docker build/run/auth/SIGTERM');
const mode=process.env.SPIKE_LINUX_MODE ?? 'worker';
if (!['worker','inline'].includes(mode)) throw new Error('Only worker/inline verification modes allowed');
const connectionClose=process.env.SPIKE_LINUX_CONNECTION_CLOSE === '1';
if (connectionClose) {
 const originalFetch=globalThis.fetch;
 globalThis.fetch=(url,init={})=>{
  const headers=new Headers(init.headers);headers.set('connection','close');
  return originalFetch(url,{...init,headers});
 };
}
const owner='future-roi-84-'+Date.now();
const db=owner+'-db', app=owner+'-app', image=owner+':verification';
const baseURL='http://127.0.0.1:3390';
const password=randomBytes(32).toString('hex'), secret=randomBytes(32).toString('hex');
mkdirSync(localDir,{recursive:true});
const envFile=join(localDir,owner+'.env'), dbFile=join(localDir,owner+'-db.env');
const log=[];
const sanitize=s=>s.replaceAll(password,'<generated-secret>').replaceAll(secret,'<generated-secret>').replaceAll(rootDir,'<candidate-package>');
async function docker(args,timeout=600000){
 return await new Promise((resolve,reject)=>{
  const p=spawn('docker',args,{cwd:rootDir,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let out='',err=''; p.stdout.on('data',b=>out+=b); p.stderr.on('data',b=>err+=b);
  const timer=setTimeout(()=>{p.kill(); reject(new Error('Owned Docker CLI timed out'));},timeout);
  p.once('error',e=>{clearTimeout(timer);reject(e);});
  p.once('close',code=>{clearTimeout(timer);log.push({operation:args[0],args:args.map(sanitize),code,stdout:sanitize(out),stderr:sanitize(err)}); code===0?resolve(out.trim()):reject(new Error('Docker '+args[0]+' failed; sanitized transcript contains details'));});
 });
}
async function cleanup(name){
 let label; try{label=await docker(['inspect','--format','{{index .Config.Labels "future-roi-verification"}}',name],10000);}catch{return;}
 if(label!==owner) throw new Error('Refused cleanup: ownership label differs');
 await docker(['rm','-f',name],10000);
}
let failed=false;
try{
 const server=JSON.parse(await docker(['version','--format','{{json .Server}}'],15000));
 if(server.Os!=='linux') throw new Error('Linux Docker engine required');
 report.info('L-env','actual local Docker Linux environment',server);
 // tmpfs-only PG data, no volume mounts, no published SQL port.
 writeFileSync(dbFile,`POSTGRES_USER=spike\nPOSTGRES_DB=future_roi_spike\nPOSTGRES_PASSWORD=${password}\n`,{mode:0o600});
 writeFileSync(envFile,`NODE_ENV=test\nDATABASE_URL=postgresql://spike:${password}@127.0.0.1:5432/future_roi_spike\nBETTER_AUTH_SECRET=${secret}\nBASE_URL=${baseURL}\nSPIKE_TRUST_PROXY_HOPS=1\nSPIKE_SIGNUP_MAX=5\nSPIKE_SIGNIN_MAX=5\nSPIKE_RL_MAX=1000\nSPIKE_PREDICT_MODE=${mode}\nSPIKE_PREDICT_MS=800\nSPIKE_WORKERS=1\nSPIKE_LOG=1\nSPIKE_SHUTDOWN_TRACE=1\n`,{mode:0o600});
 await docker(['pull','postgres:18-bookworm']);
 await docker(['build','--label','future-roi-verification='+owner,'-f','Dockerfile.verification','-t',image,'.']);
 const metadata=await docker(['image','inspect','--format','{{json .Id}} {{json .Size}}',image]);
 report.add('L-build','official Node image, locked npm dependencies, SPA and runtime build',true,{metadata});
 report.info('L-pg-image','official PG digest',await docker(['image','inspect','--format','{{json .RepoDigests}}','postgres:18-bookworm']));
 await docker(['run','-d','--name',db,'--label','future-roi-verification='+owner,'--env-file',dbFile,'--tmpfs','/var/lib/postgresql:rw','-p','127.0.0.1:3390:8080','postgres:18-bookworm']);
 let ready=false;
 for(let i=0;i<60;i++){try{await docker(['exec',db,'pg_isready','-U','spike','-d','future_roi_spike'],5000);ready=true;break;}catch{await sleep(500);}}
 if(!ready) throw new Error('Owned PG not ready');
 report.info('L-pg-version','actual isolated Linux PostgreSQL version',await docker(['exec',db,'psql','-U','spike','-d','future_roi_spike','-Atc','select version()']));
 report.info('L-node-version','actual runtime Node version',await docker(['run','--rm','--label','future-roi-verification='+owner,image,'node','--version']));
 const migration="import{createPool,createAuthPool}from'./src/pool.ts';import{createAuth}from'./src/auth.ts';import{migrate}from'./src/migrate.ts';const p=createPool({connectionString:process.env.DATABASE_URL,max:2,int8:'string'}),a=createAuthPool({connectionString:process.env.DATABASE_URL,max:2});try{console.log(JSON.stringify(await migrate(p,createAuth({pool:a,secret:process.env.BETTER_AUTH_SECRET,baseURL:process.env.BASE_URL}))));}finally{await p.end();await a.end();}";
 await docker(['run','--rm','--network','container:'+db,'--label','future-roi-verification='+owner,'--env-file',envFile,image,'node','--input-type=module','--eval',migration]);
 await docker(['run','-d','--name',app,'--network','container:'+db,'--label','future-roi-verification='+owner,'--env-file',envFile,image]);
 for(let i=0;i<60;i++){try{if((await fetch(baseURL+'/api/health')).status===200) break;}catch{}await sleep(500);if(i===59)throw new Error('Owned app not ready');}
 const shell=await fetch(baseURL+'/'); const shellText=await shell.text();
 const deep=await fetch(baseURL+'/goals/3f0c1c5e-0000-4000-8000-000000000000');
 const missing=await fetch(baseURL+'/api/nope');
 const assetPath=shellText.match(/src="([^"]+\.js)"/)?.[1];
 const asset=assetPath?await fetch(baseURL+assetPath):null;
 report.add('L-spa','one Node process serves SPA, deep route, JS and JSON API 404',shell.status===200&&shellText.includes('id="root"')&&deep.status===200&&missing.status===404&&!!asset?.headers.get('content-type')?.includes('javascript'),{shell:shell.status,deep:deep.status,apiMissing:missing.status,asset:asset?.status});
 await deep.arrayBuffer(); await missing.arrayBuffer(); if(asset) await asset.arrayBuffer();
 const A=client(baseURL,baseURL),B=client(baseURL,baseURL);
 const creds=[1,2].map(n=>({email:`u-${n}@spike.test`,password:randomBytes(24).toString('base64url'),name:'Synthetic '+n}));
 const registrations=[await A.call('POST','/api/auth/sign-up/email',creds[0]),await B.call('POST','/api/auth/sign-up/email',creds[1])];
 report.add('L-auth','only two synthetic identities register and protected cookie flow works',registrations.every(r=>r.status===200)&&(await A.call('GET','/api/auth/get-session')).status===200);
 const goal=await A.call('POST','/api/goals',goalInput('Linux synthetic'));
 const today=await A.call('GET',`/api/goals/${goal.json.id}/today`);
 const written=await A.call('PUT',`/api/goals/${goal.json.id}/logs/${today.json.today}`,{status:'DONE',amount:30});
 report.add('L-db','owner creates, writes and reads DB-backed today',goal.status===201&&written.status===200&&(await A.call('GET',`/api/goals/${goal.json.id}/today`)).json.todayLog?.status==='DONE');
 const denied=await B.call('GET',`/api/goals/${goal.json.id}`);
 const wrong=await A.call('POST','/api/goals',goalInput('reject'),{origin:'http://127.0.0.1:3391'});
 report.add('L-isolation','other owner 404 and same-site different Origin 403',denied.status===404&&wrong.status===403,{otherOwner:denied.status,wrongOrigin:wrong.status});
 const stale=A.jar.header();
 const logout=await A.call('POST','/api/auth/sign-out',{});
 const old=await fetch(baseURL+'/api/goals',{headers:{cookie:stale}});
 await old.arrayBuffer();
 report.add('L-logout','logout invalidates old Cookie and preserves multiple Set-Cookie rows',logout.status===200&&old.status===401&&logout.setCookie.length>=2,{logout:logout.status,oldCookie:old.status,setCookieCount:logout.setCookie.length});
 await A.call('POST','/api/auth/sign-in/email',{email:creds[0].email,password:creds[0].password});
 const burst=await Promise.all(Array.from({length:20},()=>A.call('POST','/api/auth/sign-in/email',{email:creds[0].email,password:creds[0].password+'x'},{'x-forwarded-for':'198.51.100.183'})));
 report.add('L-rate','20 parallel attempts admit five; 429 wait is integer 1..60',burst.filter(r=>r.status===401).length===5&&burst.filter(r=>r.status===429).length===15&&burst.filter(r=>r.status===429).every(r=>/^\d+$/.test(r.res.headers.get('x-retry-after')??'')&&Number(r.res.headers.get('x-retry-after'))>=1&&Number(r.res.headers.get('x-retry-after'))<=60),{counts:burst.reduce((a,r)=>(a[r.status]=(a[r.status]??0)+1,a),{}),waits:[...new Set(burst.filter(r=>r.status===429).map(r=>r.res.headers.get('x-retry-after')))]});
 const before=await docker(['logs',app]);
 let settled=false;
 const inflight=A.call('GET',`/api/goals/${goal.json.id}/today`).finally(()=>settled=true);
 let received=false;
 for(let i=0;i<20;i++){const now=await docker(['logs',app]);if(now.length>before.length&&now.slice(before.length).includes('/today')){received=true;break;}await sleep(20);}
 const runningAtSignal=!settled;
 const t0=performance.now();
 const stopping=docker(['stop','--time','10',app],15000);
 const [response]=await Promise.all([inflight,stopping]);
 const state=JSON.parse(await docker(['inspect','--format','{{json .State}}',app]));
 const output=await docker(['logs',app]);
 report.info('L-shutdown-phases','nonsecret shutdown phase trace',{mode,connectionClose,phases:output.split('\n').filter(s=>s.includes('shutdown-phase')||s.includes('shutdown-resource')||s.includes('shutdown-complete'))});
 report.add('L-SIGTERM','Linux SIGTERM during received in-flight worker request drains HTTP then exits 0 within 10s',received&&runningAtSignal&&response.status===200&&state.ExitCode===0&&output.includes('shutdown-complete')&&performance.now()-t0<10000,{received,runningAtSignal,response:response.status,exitCode:state.ExitCode,shutdownMs:Math.round(performance.now()-t0)});
 const sensitive=[password,secret,...creds.map(c=>c.password),...A.jar.cookies.values(),...B.jar.cookies.values()];
 report.add('L-logs','app request logs exist and omit generated credential/Cookie values',output.includes('request completed')&&sensitive.every(v=>!output.includes(v)));
 report.info('L-limits','local test scope',{transport:'HTTP, NODE_ENV=test; production HTTPS gate unchanged',memoryCpu:'Docker defaults, no Cloud Run quota emulation',engine:'synthetic CPU worker only',cloud:false});
}catch(e){failed=true;report.add('L-execution','local Linux verification completes',false,{message:e.message});}
finally{
 for(const name of [app,db]){try{await cleanup(name);}catch(e){failed=true;report.add('L-cleanup-'+name,'owned container cleanup',false,{message:e.message});}}
 // Generated env files contain only synthetic secrets. No persistent data/volume deletion.
 for(const file of [envFile,dbFile]){try{unlinkSync(file);}catch{}}
 try{const label=await docker(['image','inspect','--format','{{index .Config.Labels "future-roi-verification"}}',image],10000);if(label===owner)await docker(['image','rm',image],10000);}catch{}
 mkdirSync(join(rootDir,'results/post-fix'),{recursive:true});
 writeFileSync(join(rootDir,'results/post-fix/v6-linux-transcript.json'),JSON.stringify(log,null,2)+'\n');
 const summary=report.save('v6-linux-container.json');
 console.log(JSON.stringify(summary));
 process.exit(failed||summary.fail?1:0);
}
