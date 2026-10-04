// Supporting Artifact / Not a Source of Truth. Synthetic arithmetic, no production implementation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {completionPmf, drawsFromPosterior, quantileDays, cdfAt} from './reference/completion-dp.mjs';
import {counts} from './reference/engine2.mjs';
const K=200,H=1095,seed=20261012;
const shapes={optimistic:[3,1],neutral:[2,2],pessimistic:[1,3]};
const priors=[];
for(const strength of [4,8]) for(const [an,a] of Object.entries(shapes)) for(const [bn,b] of Object.entries(shapes))
  priors.push({id:`${an}/${bn}/s${strength}`,strength,a:a.map(x=>x*strength/4),b:b.map(x=>x*strength/4)});
const neutral=priors.find(p=>p.id==='neutral/neutral/s4');
const post=(p,c)=>({a:[p.a[0]+c.dd,p.a[1]+c.ds],b:[p.b[0]+c.sd,p.b[1]+c.ss]});
const zero={dd:0,ds:0,sd:0,ss:0};
function gq(a,b,factor){assert(Number.isInteger(a)&&a>=1&&Number.isInteger(b)&&b>=1);let n=1n,d=1n;
  for(let t=1;t<100000;t++){n*=BigInt(b+t-1);d*=BigInt(a+b+t-1);if(BigInt(factor)*n<=d)return t;}throw Error('quantile bound');}
function core(b){return {g50:gq(...b,2),g80:gq(...b,5),meanWait:b[0]<=1?'Infinity':(b[0]+b[1]-1)/(b[0]-1)};}
function summary(pmf,h=H){return {p50:quantileDays(pmf,.5,h),p80:quantileDays(pmf,.8,h),cdf7:cdfAt(pmf,Math.min(7,h)),cdf30:cdfAt(pmf,Math.min(30,h)),cdfH:cdfAt(pmf,h),tail:pmf[h+1]};}
function calculate(p,c,need=9,start='D',h=H,s=seed){const posterior=post(p,c);const draws=drawsFromPosterior(posterior,K,s);
 const begin=performance.now();const pmf=completionPmf(need,draws,h,start);const dpMs=performance.now()-begin;
 return {posterior,core:core(posterior.b),completion:summary(pmf,h),dpMs,draws,pmf:Array.from(pmf)};}
// Independent tree enumeration: all 2^h paths, exact first hitting event, not a DP recurrence.
function treePmf(need,a,b,h,start){const out=new Float64Array(h+2);
 function visit(day,last,n,prob){if(n>=need){out[day]+=prob;return;}if(day===h){out[h+1]+=prob;return;}
  const p=last==='D'?a:b;visit(day+1,'D',n+1,prob*p);visit(day+1,'S',n,prob*(1-p));}
 visit(0,start,0,1);return out;}
// Exact integration of each path's monomial against independent Beta priors (small h).
function betaMoment([a,b],s,f){let v=1;for(let i=0;i<s;i++)v*=(a+i)/(a+b+i);for(let i=0;i<f;i++)v*=(b+i)/(a+b+s+i);return v;}
function integratedTree(need,posterior,h,start){const out=new Float64Array(h+2);
 function visit(day,last,n,c){if(n>=need||day===h){out[n>=need?day:h+1]+=betaMoment(posterior.a,c.dd,c.ds)*betaMoment(posterior.b,c.sd,c.ss);return;}
  for(const next of ['D','S']){const key=last.toLowerCase()+next.toLowerCase();visit(day+1,next,n+(next==='D'),{...c,[key]:c[key]+1});}}
 visit(0,start,0,zero);return out;}
let assertions=0;const checks=[];
function check(name,fn){fn();checks.push({name,pass:true});assertions++;}
const oracle=[];
for(const p of priors)for(const start of ['D','S']){const draws=drawsFromPosterior(post(p,zero),K,seed).slice(0,3),h=10,need=3;
 const expected=new Float64Array(h+2);for(const [a,b]of draws){const one=treePmf(need,a,b,h,start);one.forEach((x,i)=>expected[i]+=x/draws.length);}
 const got=completionPmf(need,draws,h,start);const err=Math.max(...got.map((x,i)=>Math.abs(x-expected[i])));
 check(`tree oracle ${p.id} ${start}`,()=>assert(err<1e-12));
 const unpruned=completionPmf(need,draws,h,start,false);check(`prune ${p.id} ${start}`,()=>assert(got.every((x,i)=>Math.abs(x-unpruned[i])<1e-12)));
 const integrated=integratedTree(need,post(p,zero),h,start),sampled=completionPmf(need,drawsFromPosterior(post(p,zero),K,seed),h,start);
 let cf1=0,cf2=0,maxCdfError=0;for(let i=0;i<=h;i++){cf1+=integrated[i];cf2+=sampled[i];maxCdfError=Math.max(maxCdfError,Math.abs(cf1-cf2));}
 oracle.push({prior:p.id,start,maxPmfError:err,exactIntegratedPmf:Array.from(integrated),sampledPmf:Array.from(sampled),maxSamplingCdfError:maxCdfError});}
check('Beta(1,3) alpha=1 telescoping quantiles',()=>{assert.equal(gq(1,3,2),3);assert.equal(gq(1,3,5),12);});
check('Beta(2,2) exact threshold',()=>assert.deepEqual(core([2,2]),{g50:1,g80:3,meanWait:3}));
check('sampler vector',()=>{const [a,b]=drawsFromPosterior({a:[14,7],b:[7,9]},1,seed)[0];assert(Math.abs(a-.7650622193905133)<1e-15);assert(Math.abs(b-.25593304542490336)<1e-15);});
check('tiny mass regression',()=>assert.equal(quantileDays(completionPmf(1,[[.9999999995,.5],[1e-10,1e-10]],10),.5,10),3));
const initial=priors.map(p=>({prior:p,...calculate(p,zero)}));
const samplerChecks=[];
for(const shape of [[1,3],[3,1],[2,2],[2,6],[6,2],[4,4]]){
 const values=drawsFromPosterior({a:shape,b:shape},10000,seed).map(x=>x[0]),mean=values.reduce((s,x)=>s+x,0)/values.length;
 const variance=values.reduce((s,x)=>s+(x-mean)**2,0)/values.length,[a,b]=shape,theoryMean=a/(a+b),theoryVar=a*b/((a+b)**2*(a+b+1));
 check('Beta sampler moments '+shape,()=>{assert(Math.abs(mean-theoryMean)<5*Math.sqrt(theoryVar/values.length));assert(Math.abs(variance-theoryVar)<.004);assert(values.every(x=>x>0&&x<1));});
 samplerChecks.push({shape,mean,variance,theoryMean,theoryVar,n:values.length});}
for(const shape of [[1,3],[2,2],[3,1],[2,6],[6,2],[4,4]]){
 let prevSuccess=core(shape),prevFailure=core(shape);
 for(const n of [1,4,12]){const success=core([shape[0]+n,shape[1]]),failure=core([shape[0],shape[1]+n]);
  check('g direction '+shape+'/'+n,()=>{assert(success.g50<=prevSuccess.g50&&success.g80<=prevSuccess.g80);assert(failure.g50>=prevFailure.g50&&failure.g80>=prevFailure.g80);});prevSuccess=success;prevFailure=failure;}}
// Only relevant origin counts increment each posterior; 13 example transitions are not observations.
const adaptation=[];
for(const p of priors)for(const origin of ['D','S'])for(const n of [0,1,4,12])for(const evidence of ['success','failure','half']){
 const success=evidence==='success'?n:evidence==='failure'?0:Math.floor(n/2),failure=n-success;
 const c={...zero};if(origin==='D'){c.dd=success;c.ds=failure;}else{c.sd=success;c.ss=failure;}
 const po=post(p,c);adaptation.push({prior:p.id,origin,n,evidence,counts:c,posterior:po,meanA:po.a[0]/(po.a[0]+po.a[1]),meanB:po.b[0]/(po.b[0]+po.b[1]),core:core(po.b),priorWeight:p.strength/(p.strength+n)});
 check(`origin isolation ${p.id} ${origin} ${n} ${evidence}`,()=>assert.deepEqual(origin==='D'?po.b:po.a,origin==='D'?p.b:p.a));
}
// Date-aware raw-log reconstruction, amounts and status policy per current SSOT; this is a research adapter.
const dateAt=i=>new Date(Date.UTC(2026,8,1+i)).toISOString().slice(0,10);
function logsFrom(seq,base=0){return [...seq].flatMap((s,i)=>s==='U'?[]:[{localDate:dateAt(base+i),status:s==='D'?'DONE':'SKIPPED',amount:s==='D'?10:null}]);}
function rebuild(logs,today,goal,p){const sorted=[...logs].sort((x,y)=>x.localDate.localeCompare(y.localDate));const c={...zero};const seen=new Set();let actual=goal.initialProgress;
 for(let i=0;i<sorted.length;i++){const l=sorted[i];assert(l.localDate<=today);assert(!seen.has(l.localDate));seen.add(l.localDate);if(l.status==='DONE')actual+=l.amount;
  if(i&&Date.parse(l.localDate)-Date.parse(sorted[i-1].localDate)===86400000){const before=sorted[i-1].status==='DONE'?'d':'s',after=l.status==='DONE'?'d':'s';c[before+after]++;}}
 const todayLog=sorted.find(l=>l.localDate===today),todayStatus=todayLog?.status??'UNRECORDED',completed=actual>=goal.totalRequired;
 const projected=actual+(todayLog?0:goal.sessionAmount),need=Math.max(0,Math.ceil((goal.totalRequired-projected)/goal.sessionAmount));
 const coreStatus=completed?'COMPLETED':todayLog?'TODAY_RECORDED':c.sd+c.ss===0?'insufficient':'available';
 const completionStatus=completed?'completed':c.dd+c.ds===0||c.sd+c.ss===0?'insufficient':'available';
 return {counts:c,actual,todayStatus,projected,need,start:todayLog?.status==='SKIPPED'?'S':'D',coreStatus,completionStatus,posterior:post(p,c),core:core(post(p,c).b)};}
const goal={initialProgress:0,totalRequired:300,sessionAmount:10};
const sequences={allDONE:'D'.repeat(13),longSKIP:'S'.repeat(13),unknown:'DUUSDUSUD',alternating:'DS'.repeat(7),burst:'DDDDDDDSSSSSSS',allUNKNOWN:'U'.repeat(13),empty:''};
const scenarios=[];
for(const [name,seq]of Object.entries(sequences)){const logs=logsFrom(seq),today=dateAt(seq.length+1);for(const p of [neutral,priors[0],priors[8],priors[9],priors[17]]){
 const rebuilt=rebuild(logs,today,goal,p);check(`raw counts ${name} ${p.id}`,()=>assert.deepEqual(rebuilt.counts,counts([...seq])));
 const calc=calculate(p,rebuilt.counts,rebuilt.need,rebuilt.start);scenarios.push({name,sequence:seq,logs,today,goal,prior:p.id,...rebuilt,...calc});}}
const allDone=scenarios.find(x=>x.name==='allDONE');check('all DONE leaves b prior-only suppressed',()=>{assert.equal(allDone.counts.sd+allDone.counts.ss,0);assert.equal(allDone.coreStatus,'insufficient');});
const alternating=scenarios.find(x=>x.name==='alternating'),burst=scenarios.find(x=>x.name==='burst');check('alternating vs burst order matters',()=>{assert.notDeepEqual(alternating.counts,burst.counts);assert.equal(alternating.actual,burst.actual);});
const raw=logsFrom('DSD'),today=dateAt(2);raw[2].amount=7;
const amountCases=[];
for(const g of [{initialProgress:5,totalRequired:45,sessionAmount:10},{initialProgress:5,totalRequired:45,sessionAmount:6},{initialProgress:5,totalRequired:22,sessionAmount:10}]){
 const r=rebuild(raw,today,g,neutral);amountCases.push({name:'today DONE amount=7',logs:raw,today,goal:g,...r});
 check('today recorded progress no double-add '+g.sessionAmount+'/'+g.totalRequired,()=>{assert.equal(r.actual,22);assert.equal(r.projected,22);assert.equal(r.need,Math.max(0,Math.ceil((g.totalRequired-22)/g.sessionAmount)));});}
const corrected=raw.map(x=>({...x}));corrected[1]={...corrected[1],status:'DONE',amount:4};
const before=rebuild(raw,today,goal,neutral),after=rebuild(corrected,today,goal,neutral);
check('correction recomputes both neighboring transitions',()=>{assert.deepEqual(before.counts,{dd:0,ds:1,sd:1,ss:0});assert.deepEqual(after.counts,{dd:2,ds:0,sd:0,ss:0});assert.equal(after.actual-before.actual,4);assert.deepEqual(after.posterior.b,neutral.b);});
check('duplicate date rejected',()=>assert.throws(()=>rebuild([...raw,raw[0]],today,goal,neutral)));
check('future date rejected',()=>assert.throws(()=>rebuild(raw,dateAt(1),goal,neutral)));
check('completed overrides insufficiency',()=>{const r=rebuild([],today,{...goal,initialProgress:300},neutral);assert.equal(r.coreStatus,'COMPLETED');assert.equal(r.completionStatus,'completed');});
const unrecordedRaw=logsFrom('DSD'),unrecordedToday=dateAt(3);
for(const remaining of [10,20]){const g={initialProgress:0,totalRequired:20+remaining,sessionAmount:10};const r=rebuild(unrecordedRaw,unrecordedToday,g,neutral);
 check('unrecorded today remaining '+remaining,()=>{assert.equal(r.completionStatus,'available');assert.equal(r.projected,30);assert.equal(r.need,remaining===10?0:1);assert.equal(r.start,'D');});amountCases.push({name:'unrecorded remaining '+remaining,logs:unrecordedRaw,today:unrecordedToday,goal:g,...r});}
const todaySkip=[...unrecordedRaw,{localDate:unrecordedToday,status:'SKIPPED',amount:null}];
check('today SKIP current state',()=>{const r=rebuild(todaySkip,unrecordedToday,goal,neutral);assert.equal(r.start,'S');assert.equal(r.actual,r.projected);assert.equal(r.coreStatus,'TODAY_RECORDED');});
check('core amount invariance',()=>assert.deepEqual(rebuild(raw,today,goal,neutral).core,rebuild(raw,today,{...goal,totalRequired:500,sessionAmount:6},neutral).core));
// Deterministic counterexamples, not model-generated quality wins. Initial setting is deliberately wrong.
const adversarial=[];
for(const [name,a,b]of [['slowActual',.1,.05],['fastActual',.9,.95]]){const truth=completionPmf(9,[[a,b]],H,'D');
 for(const p of [neutral,priors[0],priors[8],priors[9],priors[17]]){const x=initial.find(x=>x.prior.id===p.id);adversarial.push({name,fixedActualAB:[a,b],prior:p.id,trueCore:{g50:Math.ceil(Math.log(.5)/Math.log(1-b)),g80:Math.ceil(Math.log(.2)/Math.log(1-b))},trueCompletion:summary(truth),candidateCore:x.core,candidateCompletion:x.completion});}}
// 0/1/4/12 per origin in intentionally optimistic/pessimistic wrong settings; balanced is omitted here.
const recovery=[];
for(const p of [neutral,priors[0],priors[8],priors[9],priors[17]])for(const n of [0,1,4,12])for(const direction of ['allSuccess','allFailure']){
 const c=direction==='allSuccess'?{dd:n,ds:0,sd:n,ss:0}:{dd:0,ds:n,sd:0,ss:n};const x=calculate(p,c);recovery.push({prior:p.id,nPerOrigin:n,direction,counts:c,posterior:x.posterior,core:x.core,completion:x.completion,dpMs:x.dpMs});}
const seedSensitivity=[];
for(const p of [neutral,priors[8],priors[17]])for(const need of [9,120])for(const s of [seed,seed+1,seed+2,seed+3,seed+4]){
 const x=calculate(p,zero,need,'D',H,s);seedSensitivity.push({prior:p.id,need,seed:s,completion:x.completion});}
// Three representative requirements, after warm-up, 3 repeats. Reference DP only, not HTTP/production T-14.
const timings=[];
for(const p of [neutral,priors[0],priors[8],priors[17]])for(const need of [120,400,1095]){
 const draws=drawsFromPosterior(post(p,zero),K,seed);completionPmf(need,draws,H);
 const ms=[];let result;for(let i=0;i<3;i++){const t=performance.now();result=completionPmf(need,draws,H);ms.push(performance.now()-t);}timings.push({prior:p.id,need,K,H,ms,completion:summary(result)});}
const sources=Object.fromEntries(fs.readdirSync(new URL('./reference/',import.meta.url)).map(name=>{const data=fs.readFileSync(new URL('./reference/'+name,import.meta.url));return [name,{bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}];}));
const environment={timestamp:new Date().toISOString(),node:process.version,cpu:os.cpus()[0].model,logicalCPUs:os.cpus().length,memoryBytes:os.totalmem(),platform:os.platform(),release:os.release(),K,H,seed,sourceRepoHead:'af001c6e797b9833a63234bd1646171ac8e8c542',sources};
const out={label:'Supporting Artifact / synthetic only / uncalibrated design candidates',environment,checks,assertions,initial,adaptation,oracle,samplerChecks,scenarios,amountCases,correction:{raw,corrected,before,after},adversarial,recovery,recoveryCaveat:'Independent origin stress counts, not necessarily jointly realizable as one raw chronology. Not actual observed logs.',seedSensitivity,timings};
fs.writeFileSync(new URL('./results/raw.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
const compact={environment,assertions,initial:initial.map(x=>({id:x.prior.id,core:x.core,completion:x.completion,dpMs:x.dpMs})),oracleMaxPmfError:Math.max(...oracle.map(x=>x.maxPmfError)),posteriorSamplingMaxCdfError:Math.max(...oracle.map(x=>x.maxSamplingCdfError)),timings};
fs.writeFileSync(new URL('./results/summary.json',import.meta.url),JSON.stringify(compact,null,2)+'\n');
console.log(JSON.stringify(compact,null,2));
