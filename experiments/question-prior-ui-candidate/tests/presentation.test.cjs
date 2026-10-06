// Real React SSR assertions. Browser events/focus need the separate preview checklist.
const test=require('node:test');
const assert=require('node:assert/strict');
const { join }=require('node:path');
const React=require('react');
const { renderToStaticMarkup }=require('react-dom/server');
const build=process.env.UI_CANDIDATE_BUILD;
if(!build)throw new Error('Use scripts/check.mjs to compile this candidate first.');
const { QuestionPriorFields }=require(join(build,'src/QuestionPriorFields.js'));
const { PriorForecast, sourceLabel, sourceNote, assertForecastPresentation }=require(join(build,'src/PriorForecast.js'));
const { GoalQuestionSlotExample }=require(join(build,'examples/slots.js'));
const { partial, conditional, views }=require(join(build,'examples/views.js'));
const fields=props=>renderToStaticMarkup(React.createElement(QuestionPriorFields,{value:{a:null,b:null},onChange:()=>{},...props}));
const forecast=view=>renderToStaticMarkup(React.createElement(PriorForecast,{view}));
const checked=html=>[...html.matchAll(/<input\b[^>]*>/g)].map(x=>x[0]).filter(x=>/\bchecked=""/.test(x)).map(x=>x.match(/\bvalue="([^"]*)"/)[1]);
test('two optional native groups distinguish UNKNOWN from unanswered',()=>{
  const html=fields({value:{a:null,b:'UNKNOWN'}});
  assert.equal((html.match(/<fieldset/g)||[]).length,2);
  assert.equal((html.match(/<legend/g)||[]).length,2);
  assert.equal((html.match(/type="radio"/g)||[]).length,10);
  assert.deepEqual(checked(html),['','UNKNOWN']);assert.doesNotMatch(html,/\brequired=/);
});
test('all provided answer combinations remain explicit',()=>{
  for(const a of [null,'LOW','MID','HIGH','UNKNOWN'])for(const b of [null,'LOW','MID','HIGH','UNKNOWN'])
    assert.deepEqual(checked(fields({value:{a,b}})),[a??'',b??'']);
});
test('multiple instances have distinct label IDs and group names',()=>{
  const html=renderToStaticMarkup(React.createElement('div',null,React.createElement(QuestionPriorFields,{value:{a:'MID',b:null},onChange:()=>{}}),React.createElement(QuestionPriorFields,{value:{a:null,b:'LOW'},onChange:()=>{}})));
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length);
  for(const ref of html.matchAll(/\bfor="([^"]+)"/g))assert.ok(ids.includes(ref[1]));
  assert.equal(new Set([...html.matchAll(/\bname="([^"]+)"/g)].map(x=>x[1])).size,4);
});
test('field errors are linked, escaped and only applied to the requested origin',()=>{
  const html=fields({fieldErrors:{b:'<script>bad</script>'}});
  assert.match(html,/role="alert"/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
  assert.equal((html.match(/aria-invalid="true"/g)||[]).length,5);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  for(const ref of html.matchAll(/aria-describedby="([^"]+)"/g))for(const id of ref[1].split(' '))assert.ok(ids.includes(id));
});
test('saving disables both groups; failed preserves provided answers and does not claim success',()=>{
  const render=saveState=>renderToStaticMarkup(React.createElement(GoalQuestionSlotExample,{value:{a:'LOW',b:'HIGH'},onChange:()=>{},saveState}));
  assert.equal((render({kind:'saving'}).match(/<fieldset disabled=""/g)||[]).length,2);
  const failed=render({kind:'failed',message:'<img src=x onerror=bad()>'});
  assert.deepEqual(checked(failed),['LOW','HIGH']);assert.match(failed,/&lt;img/);assert.doesNotMatch(failed,/回答を保存しました/);
});
test('F04 partial answer displays a provisional core, actual records and conditional counts',()=>{
  const html=forecast(partial);assert.match(html,/約3日/);assert.match(html,/回答に基づく仮/);
  assert.match(html,/60／100分/);assert.match(html,/実際の記録はまだありません/);assert.match(html,/あと3回分/);
  assert.match(html,/日数の予測ではありません/);assert.match(html,/最後に必要な量は10分/);
});
test('missing material is separate from communication errors',()=>{
  const html=forecast(views.missing);assert.match(html,/材料が不足/);assert.doesNotMatch(html,/約3日/);
  const failed=forecast(views.error);assert.match(failed,/role="alert"/);assert.doesNotMatch(failed,/材料が不足/);
});
test('core provenance uses the exact question/mixed/record-only note',()=>{
  for(const [source,label] of [['QUESTION','回答'],['QUESTION_AND_RECORDS','回答＋実績'],['RECORDS','実績']]){
    const html=forecast({...partial,core:{kind:'estimate',days:3,source}});assert.match(html,new RegExp('>'+label.replace('+','\\+')+'</span>'));
    assert.match(html,/将来を保証するものではありません/);
  }
});
test('completion labels and per-origin sources come from the parent without date computation',()=>{
  const completion={kind:'estimate',scenario:'TODAY_DONE',sources:{a:'RECORDS',b:'QUESTION_AND_RECORDS'},p50Days:7,p80Days:14,p50Label:'表示確認用の週A',p80Label:'表示確認用の週B'};
  const html=forecast({...partial,completion});assert.match(html,/表示確認用の週A/);assert.match(html,/表示確認用の週B/);
  assert.match(html,/取り組めた日の翌日：実績／休んだ日の翌日：回答＋実績/);assert.match(html,/まだ実際の記録・達成には反映されていません/);
});
test('record-only completion does not imply a question answer',()=>{
  const html=forecast({...partial,core:{kind:'estimate',days:3,source:'RECORDS'},completion:{kind:'estimate',scenario:'TODAY_DONE',sources:{a:'RECORDS',b:'RECORDS'},p50Days:7,p80Days:14,p50Label:'表示用A',p80Label:'表示用B'}});
  assert.doesNotMatch(html,/初期の回答は仮定/);assert.match(html,/翌日：実績／/);
});
test('a null horizon has an explicit display and no invented finite week',()=>{
  const html=forecast({...partial,completion:{kind:'estimate',scenario:'TODAY_DONE',sources:{a:'QUESTION',b:'QUESTION'},p50Days:null,p80Days:null,p50Label:null,p80Label:null}});
  assert.match(html,/3年以上先/);assert.doesNotMatch(html,/undefined|null/);
  assert.match(html,/>3年以上先<\/p>/);
  assert.match(html,/10回中8回の完了の目安も3年以上先です。/);
});
test('actual completion and recorded-day states exclude core comparison',()=>{
  const done=forecast(views.completed);assert.match(done,/目標を達成/);assert.match(done,/100／100分/);assert.doesNotMatch(done,/data-r11-aux|約3日/);
  const recorded=forecast(views.recorded);assert.match(recorded,/今日は記録済み/);assert.doesNotMatch(recorded,/ゴールが遠ざかる日数/);
});
test('recorded-day CURRENT_STATE completion excludes the hypothetical Today heading',()=>{
  const html=forecast({...views.recorded,completion:{kind:'estimate',scenario:'CURRENT_STATE',sources:{a:'RECORDS',b:'QUESTION'},p50Days:7,p80Days:14,p50Label:'表示用A',p80Label:'表示用B'}});
  assert.match(html,/現在の状態から/);assert.doesNotMatch(html,/今日やった場合/);
});
test('loading, failed refresh and unknown save do not retain stale numbers',()=>{
  for(const name of ['loading','refresh','unknown'])assert.doesNotMatch(forecast(views[name]),/data-r11-aux|r11-qp-value|60／100/);
});
test('unresolved or invalid presentation values cannot silently become estimates',()=>{
  for(const view of [
    {...partial,core:{kind:'estimate',days:1,source:'NONE'}},
    {...partial,core:{kind:'estimate',days:NaN,source:'QUESTION'}},
    {...partial,resumed:{success:2,total:1}},
    {...partial,completion:{kind:'fixture-pending'}},
    {...partial,completion:{kind:'estimate',scenario:'TODAY_DONE',sources:{a:'NONE',b:'QUESTION'},p50Days:7,p80Days:14,p50Label:'A',p80Label:'B'}},
    {...partial,completion:{kind:'estimate',scenario:'TODAY_DONE',sources:{a:'QUESTION',b:'QUESTION'},p50Days:null,p80Days:14,p50Label:null,p80Label:'B'}},
    {...partial,completion:{...conditional,plan:{...conditional.plan,lastAmount:16}}},
    {...views.recorded,completion:{kind:'estimate',scenario:'TODAY_DONE',sources:{a:'QUESTION',b:'QUESTION'},p50Days:7,p80Days:14,p50Label:'A',p80Label:'B'}},
    {kind:'toString'},
  ])assert.throws(()=>forecast(view),TypeError);
});

test('source helpers are public and NONE cannot supply an estimate note',()=>{
  assert.deepEqual(['NONE','QUESTION','QUESTION_AND_RECORDS','RECORDS'].map(sourceLabel),['不足','回答','回答＋実績','実績']);
  for(const source of ['QUESTION','QUESTION_AND_RECORDS','RECORDS'])assert.match(sourceNote(source),/将来を保証/);
  for(const source of ['NONE','toString',undefined])assert.throws(()=>sourceNote(source),TypeError);
  assert.throws(()=>sourceLabel('toString'),TypeError);
});

test('an external heading replaces only the internal h2 and preserves all references',()=>{
  const html=renderToStaticMarkup(React.createElement('details',{open:true},React.createElement('summary',{id:'goal-heading'},'任意の質問'),React.createElement(QuestionPriorFields,{value:{a:'MID',b:'UNKNOWN'},onChange:()=>{},externalHeadingId:'goal-heading',fieldErrors:{b:'確認してください'}})));
  assert.doesNotMatch(html,/<h2/);assert.match(html,/aria-labelledby="goal-heading"/);assert.deepEqual(checked(html),['MID','UNKNOWN']);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  for(const ref of html.matchAll(/aria-(?:labelledby|describedby)="([^"]+)"/g))for(const id of ref[1].split(' '))assert.ok(ids.includes(id));
  assert.match(fields({}),/<h2/);
  for(const externalHeadingId of ['', 'two ids',null,42])assert.throws(()=>fields({externalHeadingId}),TypeError);
});

test('R-06 record-only insufficiency carries resolved text without a conditional Plan',()=>{
  const missing=forecast(views['records-missing']);
  assert.match(missing,/まだ「休んだ翌日」の記録がありません/);assert.match(missing,/「やった翌日」と「休んだ翌日」の記録がそれぞれたまると/);
  assert.doesNotMatch(missing,/あと\d+回分|回答に基づく|0回中0回|約\d+日/);
  const partial=forecast(views['records-partial']);assert.match(partial,/約3日/);assert.match(partial,/2回中1回/);assert.match(partial,/完了の目安を表示します/);assert.doesNotMatch(partial,/あと\d+回分/);
  const recorded=forecast(views['records-recorded']);assert.match(recorded,/今日は記録済み/);assert.match(recorded,/完了の目安を表示します/);assert.doesNotMatch(recorded,/ゴールが遠ざかる|今日やった場合/);
});

test('shared guard protects a separate renderer without mounting PriorForecast',()=>{
  const render=view=>{assertForecastPresentation(view);return view.kind==='forecast'?view.resumed.total:null;};
  assert.equal(render(views['records-partial']),2);
  for(const view of [null,{}, {...partial,progress:{...partial.progress,done:Infinity}}, {...partial,resumed:{success:1,total:0}}, {...partial,core:{kind:'estimate',days:2,source:'NONE'}}, {...partial,completion:{...conditional,plan:{...conditional.plan,sessions:0}}}, {...partial,completion:{kind:'insufficient',message:''}}, {...partial,core:{kind:'invalid'}}, {...partial,core:{kind:'insufficient',message:42}}])assert.throws(()=>render(view),TypeError);
});

test('raw completion days preserve zero/null and reject misleading labels or quantiles',()=>{
  const completion={kind:'estimate',scenario:'TODAY_DONE',sources:{a:'RECORDS',b:'RECORDS'},p50Days:0,p80Days:14,p50Label:'同じ週のラベル',p80Label:'別の表示文言'};
  const view={...partial,completion};assertForecastPresentation(view);assert.equal(view.completion.p50Days,0);assert.match(forecast(view),/同じ週のラベル/);assert.match(forecast(view),/まだ実際の記録・達成には反映されていません/);
  for(const changes of [{p50Days:undefined},{p50Days:NaN},{p50Days:-1},{p80Days:1.5},{p80Days:Infinity},{p50Days:15},{p50Days:null},{p80Label:null},{scenario:'CURRENT_STATE'}])assert.throws(()=>assertForecastPresentation({...partial,completion:{...completion,...changes}}),TypeError);
  const beyond={...partial,completion:{...completion,p50Days:null,p80Days:null,p50Label:null,p80Label:null}};assertForecastPresentation(beyond);assert.match(forecast(beyond),/3年以上先/);
});

test('finite p50 and out-of-horizon p80 keep the finite label without implying both are beyond horizon',()=>{
  const completion={kind:'estimate',sources:{a:'QUESTION',b:'RECORDS'},p50Days:7,p80Days:null,p50Label:'表示fixture:7日',p80Label:null};
  for(const view of [
    {...partial,completion:{...completion,scenario:'TODAY_DONE'}},
    {...views.recorded,completion:{...completion,scenario:'CURRENT_STATE'}},
  ]){
    assertForecastPresentation(view);
    const html=forecast(view);assert.match(html,/>表示fixture:7日<\/p>/);
    assert.match(html,/10回中8回の完了の目安は3年以上先です。/);
    assert.doesNotMatch(html,/目安も3年以上先/);
    assert.equal(view.completion.p50Days,7);assert.equal(view.completion.p80Days,null);
  }
});

test('same-day quantiles retain the hypothetical condition and do not claim actual achievement',()=>{
  const view={...partial,progress:{done:15,total:16,unit:'minutes'},completion:{kind:'estimate',scenario:'TODAY_DONE',sources:{a:'QUESTION',b:'QUESTION'},p50Days:0,p80Days:0,p50Label:'表示fixture:今日',p80Label:'表示fixture:今日'}};
  assertForecastPresentation(view);const html=forecast(view);
  assert.match(html,/10回中8回の完了の目安：表示fixture:今日/);
  assert.match(html,/15／16分/);assert.match(html,/まだ実際の記録・達成には反映されていません/);
  assert.doesNotMatch(html,/3年以上先|目標を達成しました/);
});

test('insufficiency and conditional counts do not acquire a horizon estimate',()=>{
  for(const view of [views['records-missing'],views['records-partial'],views['records-recorded'],partial]){
    assertForecastPresentation(view);
    const html=forecast(view);assert.doesNotMatch(html,/10回中8回|3年以上先/);
  }
  for(const completion of [
    {kind:'estimate',scenario:'TODAY_DONE',sources:{a:'RECORDS',b:'RECORDS'},p50Days:Infinity,p80Days:null,p50Label:'A',p80Label:null},
    {kind:'estimate',scenario:'TODAY_DONE',sources:{a:'RECORDS',b:'RECORDS'},p50Days:null,p80Days:7,p50Label:null,p80Label:'B'},
  ]){
    const view={...partial,completion};
    assert.throws(()=>assertForecastPresentation(view),TypeError);assert.throws(()=>forecast(view),TypeError);
  }
});

test('conditional plans require a nonblank reason through both the shared guard and renderer',()=>{
  assertForecastPresentation(partial);
  assert.match(forecast(partial),/これは日数の予測ではありません/);
  for(const reason of ['', '   ', '\n\t', null, 42]){
    const view={...partial,completion:{...partial.completion,reason}};
    assert.throws(()=>assertForecastPresentation(view),TypeError);
    assert.throws(()=>forecast(view),TypeError);
  }
});
