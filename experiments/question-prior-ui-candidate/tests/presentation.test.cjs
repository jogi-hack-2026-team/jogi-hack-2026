// Real React SSR assertions. Browser events/focus need the separate preview checklist.
const test=require('node:test');
const assert=require('node:assert/strict');
const { join }=require('node:path');
const React=require('react');
const { renderToStaticMarkup }=require('react-dom/server');
const build=process.env.UI_CANDIDATE_BUILD;
if(!build)throw new Error('Use scripts/check.mjs to compile this candidate first.');
const { QuestionPriorFields }=require(join(build,'src/QuestionPriorFields.js'));
const { PriorForecast }=require(join(build,'src/PriorForecast.js'));
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
  const completion={kind:'estimate',scenario:'TODAY_DONE',sources:{a:'RECORDS',b:'QUESTION_AND_RECORDS'},p50Label:'表示確認用の週A',p80Label:'表示確認用の週B'};
  const html=forecast({...partial,completion});assert.match(html,/表示確認用の週A/);assert.match(html,/表示確認用の週B/);
  assert.match(html,/取り組めた日の翌日：実績／休んだ日の翌日：回答＋実績/);assert.match(html,/まだ実際の記録・達成には反映されていません/);
});
test('record-only completion does not imply a question answer',()=>{
  const html=forecast({...partial,core:{kind:'estimate',days:3,source:'RECORDS'},completion:{kind:'estimate',scenario:'TODAY_DONE',sources:{a:'RECORDS',b:'RECORDS'},p50Label:'表示用A',p80Label:'表示用B'}});
  assert.doesNotMatch(html,/初期の回答は仮定/);assert.match(html,/翌日：実績／/);
});
test('a null horizon has an explicit display and no invented finite week',()=>{
  const html=forecast({...partial,completion:{kind:'estimate',scenario:'TODAY_DONE',sources:{a:'QUESTION',b:'QUESTION'},p50Label:null,p80Label:null}});
  assert.match(html,/3年以上先/);assert.doesNotMatch(html,/undefined|null/);
});
test('actual completion and recorded-day states exclude core comparison',()=>{
  const done=forecast(views.completed);assert.match(done,/目標を達成/);assert.match(done,/100／100分/);assert.doesNotMatch(done,/data-r11-aux|約3日/);
  const recorded=forecast(views.recorded);assert.match(recorded,/今日は記録済み/);assert.doesNotMatch(recorded,/ゴールが遠ざかる日数/);
});
test('recorded-day CURRENT_STATE completion excludes the hypothetical Today heading',()=>{
  const html=forecast({...views.recorded,completion:{kind:'estimate',scenario:'CURRENT_STATE',sources:{a:'RECORDS',b:'QUESTION'},p50Label:'表示用A',p80Label:'表示用B'}});
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
    {...partial,completion:{kind:'estimate',scenario:'TODAY_DONE',sources:{a:'NONE',b:'QUESTION'},p50Label:'A',p80Label:'B'}},
    {...partial,completion:{kind:'estimate',scenario:'TODAY_DONE',sources:{a:'QUESTION',b:'QUESTION'},p50Label:null,p80Label:'B'}},
    {...partial,completion:{...conditional,plan:{...conditional.plan,lastAmount:16}}},
    {...views.recorded,completion:{kind:'estimate',scenario:'TODAY_DONE',sources:{a:'QUESTION',b:'QUESTION'},p50Label:'A',p80Label:'B'}},
    {kind:'toString'},
  ])assert.throws(()=>forecast(view),TypeError);
});
