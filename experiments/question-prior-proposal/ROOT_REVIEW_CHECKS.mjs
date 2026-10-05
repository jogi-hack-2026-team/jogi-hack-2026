// Independent reviewer checks. Repository-external supporting artifact.
import assert from 'node:assert/strict';
import { betaGeometricQuantile, makeInitialPrior, evaluate, rebuildRaw } from './src/prototype.ts';
import { completionPmf } from './reference/completion-dp.mjs';

let checks = 0;
// Independent analytic CDF for alpha=1,2; no sampler or recurrence oracle.
for (const [alpha, beta] of [[1,3],[2,6],[1,1000],[2,1000]]) {
  for (const q of [50,80]) {
    let t = 1;
    while ((alpha === 1 ? beta/(beta+t) : beta*(beta+1)/((beta+t)*(beta+t+1))) > 1-q/100+1e-14) t++;
    assert.equal(betaGeometricQuantile([alpha,beta],q),t); checks++;
  }
}
// Full binary-path first-hitting enumeration, independently of the DP.
function enumerate(need,a,b,H,start) {
  const pmf = new Float64Array(H+1);
  function walk(t,done,state,p) {
    if (done === need) { pmf[t] += p; return; }
    if (t === H) return;
    const success = state === 'D' ? a : b;
    walk(t+1,done+1,'D',p*success);
    walk(t+1,done,'S',p*(1-success));
  }
  walk(0,0,start,1); return pmf;
}
let maxError = 0;
for (const [a,b] of [[0,0],[1,1],[.1,.05],[.9,.95],[.25,.75]]) {
  for (const start of ['D','S']) {
    const oracle = enumerate(3,a,b,8,start);
    const dp = completionPmf(3,[[a,b]],8,start);
    for (let t=0;t<=8;t++) maxError = Math.max(maxError,Math.abs(oracle[t]-dp[t]));
    assert.ok(maxError < 1e-12); checks++;
  }
}
const goal = { totalRequired: 100, sessionAmount: 10, initialProgress: 5, frequency: 'daily', actionSpec: 'reading-pages' };
const prior = makeInitialPrior({experience:'same_action',afterDone:'often',afterSkip:'rarely'},goal.actionSpec);
const logs = [
  {localDate:'2026-10-01',status:'DONE',amount:10},
  {localDate:'2026-10-02',status:'SKIPPED',amount:null},
  {localDate:'2026-10-03',status:'DONE',amount:7},
];
const result = evaluate(goal,logs,'2026-10-03',prior,'questionnaire_draft',{samples:10,horizonDays:20,seed:1});
assert.equal(result.actualDone,22); checks++;
assert.equal(result.projectedDone,22); checks++;
assert.deepEqual(result.posterior,{a:[3,2],b:[2,3]}); checks++;
const corrected = rebuildRaw(logs.map(x=>x.status==='SKIPPED'?{...x,status:'DONE',amount:10}:x),'2026-10-03',goal);
assert.deepEqual(corrected.counts,{dd:2,ds:0,sd:0,ss:0}); checks++;
const gap = rebuildRaw([logs[0],logs[2]],'2026-10-03',goal);
assert.deepEqual(gap.counts,{dd:0,ds:0,sd:0,ss:0}); checks++;
const complete = evaluate({...goal,totalRequired:5,frequency:'non_daily'},[],'2026-10-03',prior);
assert.equal(complete.completion.status,'completed'); checks++;
const unknown = makeInitialPrior({experience:'new_action',afterDone:'often',afterSkip:'rarely'},goal.actionSpec);
const fallback = evaluate(goal,[],'2026-10-03',unknown,'questionnaire_draft');
assert.equal(fallback.completion.status,'conditional_plan'); checks++;
assert.equal(fallback.plan.daysFromToday,9); checks++;
assert.equal(fallback.provenance.b.observations,0); checks++;
console.log(JSON.stringify({checks,maxError,status:'passed'},null,2));
