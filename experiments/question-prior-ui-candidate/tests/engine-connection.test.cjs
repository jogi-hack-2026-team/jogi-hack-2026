// Positive cases always execute separately compiled PR119 Engine source.
// Raw answers/context are local fixtures, not saved Goal or HTTP response claims.
const test=require('node:test');
const assert=require('node:assert/strict');
const { readFileSync,writeFileSync }=require('node:fs');
const { join }=require('node:path');
const React=require('react');
const { renderToStaticMarkup }=require('react-dom/server');
const document=JSON.parse(readFileSync(process.env.UI_CONNECTION_FIXTURES,'utf8'));
const { evaluateQuestionPriorAdapterCandidate:evaluate }=require(join(process.env.UI_ENGINE_BUILD,'src/question-prior-adapter-candidate.js'));
const { engineViewExample:map }=require(join(process.env.UI_CANDIDATE_BUILD,'examples/engine-view.js'));
const { PriorForecast }=require(join(process.env.UI_CANDIDATE_BUILD,'src/PriorForecast.js'));
const { QuestionPriorFields }=require(join(process.env.UI_CANDIDATE_BUILD,'src/QuestionPriorFields.js'));
const byId=id=>document.calculationExamples.find(x=>x.id===id);
const calculate=fixture=>evaluate({prediction:fixture.input,answers:fixture.answers,mapping:document.mappingCandidate},fixture.config);
const render=view=>renderToStaticMarkup(React.createElement(PriorForecast,{view}));
const context=(fixture,format=days=>`表示fixture:${days}日`)=>({unit:'minutes',sessionAmount:fixture.input.goal.sessionAmount,formatCompletionDays:format});
const cases=[];
for(const fixture of document.calculationExamples)test(`${fixture.id}: real Engine -> candidate view -> React`,()=>{
  const before=JSON.stringify(fixture), result=calculate(fixture), calls=[];
  const view=map(result,context(fixture,(days,scenario)=>{calls.push({days,scenario});return `表示fixture:${days}日`;}));
  const html=render(view), expected=fixture.expected;
  for(const key of ['progress','observations','evidenceSource','coreMetric','conditionalPlan'])assert.deepEqual(result[key],expected[key],`${fixture.id} independent shared fixture ${key}`);
  for(const key of ['status','reason','scenario','p50Days','p80Days'])if(Object.hasOwn(expected.completion,key))assert.deepEqual(result.completion[key],expected.completion[key]);
  assert.equal(view.progress.done,result.progress.done);assert.equal(view.progress.total,result.progress.total);
  if(result.progress.completed){
    assert.equal(view.kind,'completed');assert.match(html,/目標を達成/);assert.doesNotMatch(html,/data-r11-aux|あと0回|ゴールが遠ざかる/);
  }else{
    assert.deepEqual(view.resumed,{success:expected.observations.nSD,total:expected.observations.nSD+expected.observations.nSS});
    assert.equal(view.kind,result.todayStatus==='UNRECORDED'?'forecast':'today-recorded');
    if(view.kind==='today-recorded'){assert.ok(!Object.hasOwn(view,'core'));assert.doesNotMatch(html,/ゴールが遠ざかる/);}
    else if(expected.coreMetric.status==='available'){
      assert.deepEqual(view.core,{kind:'estimate',days:expected.coreMetric.g50,source:expected.evidenceSource.b});
      assert.ok(html.includes(`約${expected.coreMetric.g50}日`));
    }else{assert.equal(view.core.kind,'insufficient');assert.doesNotMatch(html,/約\d+日/);}
    if(expected.completion.status==='insufficient'){
      assert.equal(view.completion.kind,'conditional');assert.deepEqual(view.completion.plan,{
        remainingAmount:expected.conditionalPlan.remainingAmount,sessions:expected.conditionalPlan.remainingSessions,
        lastAmount:expected.conditionalPlan.lastSessionAmount,sessionAmount:fixture.input.goal.sessionAmount,unit:'minutes',
      });
      assert.ok(html.includes(`あと${expected.conditionalPlan.remainingSessions}回分`));
      assert.match(html,/これは日数の予測ではありません/);assert.doesNotMatch(html,/表示fixture:/);assert.deepEqual(calls,[]);
    }else{
      assert.equal(view.completion.kind,'estimate');assert.deepEqual(view.completion.sources,expected.evidenceSource);
      const completion=result.completion;
      assert.deepEqual(calls,[completion.p50Days,completion.p80Days].filter(x=>x!==null).map(days=>({days,scenario:completion.scenario})));
      for(const key of ['p50','p80'])assert.equal(view.completion[`${key}Label`],completion[`${key}Days`]===null?null:`表示fixture:${completion[`${key}Days`]}日`);
      assert.doesNotMatch(html,/あと\d+回分/); // Plan must not become a third auxiliary indicator.
    }
  }
  const fields=renderToStaticMarkup(React.createElement(QuestionPriorFields,{value:result.rawAnswers,onChange:()=>{}}));
  const values=[...fields.matchAll(/<input\b[^>]*checked=""[^>]*>/g)].map(x=>x[0].match(/value="([^"]*)"/)[1]);
  assert.deepEqual(values,[fixture.answers.a??'',fixture.answers.b??'']);
  assert.equal(JSON.stringify(fixture),before); // Neither mapping nor Engine mutates fixture state.
  cases.push({id:fixture.id,result,view,html});
});
test('answer correction/clear recalculates from the same full logs without fake progress',()=>{
  const original=byId('F09'), before=JSON.stringify(original.input);
  const low=calculate(original), high=calculate({...original,answers:{a:'HIGH',b:'HIGH'}});
  const cleared=calculate({...original,answers:{a:null,b:null}});
  assert.deepEqual(low.progress,high.progress);assert.deepEqual(high.progress,cleared.progress);
  assert.deepEqual(low.observations,high.observations);assert.deepEqual(high.observations,cleared.observations);
  assert.equal(map(low,context(original)).core.days,2);assert.equal(map(high,context(original)).core.days,1);
  const clearedView=map(cleared,context(original));assert.equal(clearedView.core.source,'RECORDS');assert.equal(clearedView.completion.kind,'conditional');
  assert.deepEqual(calculate({...original,answers:{a:'HIGH',b:'HIGH'}}),high);
  assert.equal(JSON.stringify(original.input),before);
});
test('unanswered and explicit MID share a prior number but not eligibility/rendering',()=>{
  const missing=calculate(byId('F01')), mid=calculate(byId('F03'));
  assert.deepEqual(missing.posterior,mid.posterior);
  assert.equal(map(missing,context(byId('F01'))).completion.kind,'conditional');
  assert.equal(map(mid,context(byId('F03'))).completion.kind,'estimate');
});
test('conditional plan names are copied exactly; UI does not round or recalculate',()=>{
  const fixture=byId('F04'), actual=calculate(fixture);
  // Deliberately inconsistent test projection distinguishes copying from formula duplication.
  const projection={...actual,conditionalPlan:{remainingAmount:40,remainingSessions:9,lastSessionAmount:8}};
  assert.deepEqual(map(projection,context(fixture)).completion.plan,{remainingAmount:40,sessions:9,lastAmount:8,sessionAmount:15,unit:'minutes'});
  for(const unit of ['minutes','sessions']){
    const view=map(actual,{...context(fixture),unit});assert.equal(view.progress.unit,unit);assert.equal(view.completion.plan.unit,unit);
    assert.ok(render(view).includes(unit==='minutes'?'残り40分':'残り40回'));
  }
});
test('actual Today DONE reaches target while hypothetical zero-day does not',()=>{
  const original=byId('F14'), fixture={...original,input:{...original.input,goal:{...original.input.goal,initialProgress:15}}};
  const actual=calculate(fixture);assert.equal(actual.todayStatus,'DONE');assert.equal(actual.progress.done,22);
  assert.equal(map(actual,context(fixture)).kind,'completed');
  const hypothetical=byId('F17'), view=map(calculate(hypothetical),context(hypothetical));
  assert.equal(view.kind,'forecast');assert.equal(view.progress.done,15);assert.equal(view.progress.total,16);
  assert.equal(view.completion.p50Label,'表示fixture:0日');assert.match(render(view),/まだ実際の記録・達成には反映されていません/);
});
test('real null horizons remain null and do not call the label formatter',()=>{
  const fixture=byId('F18'), calls=[],view=map(calculate(fixture),context(fixture,x=>{calls.push(x);return 'BAD';}));
  assert.equal(view.completion.p50Label,null);assert.equal(view.completion.p80Label,null);assert.deepEqual(calls,[]);
  assert.match(render(view),/3年以上先/);assert.doesNotMatch(render(view),/BAD|undefined/);
});
test('invalid projections are rejected rather than silently displayed',()=>{
  const fixture=byId('F03'), actual=calculate(fixture);
  assert.throws(()=>map({...actual,evidenceSource:{a:'QUESTION',b:'NONE'}},context(fixture)),TypeError);
  assert.throws(()=>map(actual,{...context(fixture),sessionAmount:0}),TypeError);
  assert.throws(()=>map({...actual,completion:{...actual.completion,scenario:'CURRENT_STATE'}},context(fixture)),TypeError);
  const recorded=calculate(byId('F14'));
  assert.throws(()=>map({...recorded,completion:{...recorded.completion,scenario:'TODAY_DONE'}},context(byId('F14'))),TypeError);
  assert.throws(()=>map({...actual,completion:{status:'completed'}},context(fixture)),TypeError);
});
test.after(()=>writeFileSync(process.env.UI_CONNECTION_EVIDENCE,JSON.stringify({sharedCaseCount:cases.length,
  fixtureSaving:false,weekLabels:'explicit synthetic formatter, not adopted week conversion',cases},null,2)+'\n'));
