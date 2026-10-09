// Explicit local synthetic image acceptance runner; not part of node:test glob.
// Start the Issue148-only Compose fixture described in docs/operations/issue148-verification.md.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import pg from 'pg';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.ISSUE148_PLAYWRIGHT_ROOT ?? 'C:/Users/kaito/Documents/Github/for_test/node_modules/playwright-core');
const origin = 'http://127.0.0.1:8097';
const out = '.tools/issue148/browser'; mkdirSync(out, { recursive: true });
const pool = new pg.Pool({ host: '127.0.0.1', port: 15488, database: 'futureroi_issue148', user: 'issue148_synthetic', password: 'issue148-synthetic-only', max: 1 });
assert.deepEqual((await pool.query('select current_database() db,current_user owner')).rows[0], { db: 'futureroi_issue148', owner: 'issue148_synthetic' });
const browser = await chromium.launch({ executablePath: process.env.ISSUE148_BROWSER_EXE ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const cases = []; const contexts = [];
const wait = async fn => { for(let i=0;i<100;i++){ if(await fn()) return; await new Promise(r=>setTimeout(r,50)); } throw Error('condition timeout'); };
async function fixture() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Tokyo' }); contexts.push(context);
  const creds = { name: '合成ユーザー', email: `${randomUUID()}@example.test`, password: 'Synthetic-148-only-password!' };
  const request = async (method,path,data,extra={}) => {
    const response = await context.request.fetch(origin+path, { method, headers: { origin, ...extra }, ...(data ? { data } : {}) });
    const text = await response.text(); return { status: response.status(), json: text ? JSON.parse(text) : null };
  };
  assert.equal((await request('POST','/api/auth/sign-up/email',creds)).status,200);
  const session = (await request('GET','/api/auth/get-session')).json;
  const page = await context.newPage(); page.setDefaultTimeout(7000);
  const requests=[];
  page.on('request', r=> { if (r.method() !== 'GET' && new URL(r.url()).pathname.startsWith('/api/goals')) requests.push({ method:r.method(),path:new URL(r.url()).pathname,body:r.postDataJSON(), key:r.headers()['idempotency-key'] }); });
  const create = async (extra={}) => { const body={ title:'合成Goal',unit:'minutes',totalRequired:1000,sessionAmount:10,timezone:'Asia/Tokyo',...extra }; const res=await request('POST','/api/goals',body,{'Idempotency-Key':randomUUID()}); assert.equal(res.status,201);return res.json; };
  const open = async g => { await page.goto(`${origin}/goals/${g.id}`); await page.getByRole('button',{name:/^やった/}).last().waitFor(); };
  const patch = async (g,extra) => { const res=await request('PATCH',`/api/goals/${g.id}`,{expectedGoalSettingsRevision:g.goalSettingsRevision,...extra});assert.equal(res.status,200);return res.json; };
  return { context,page,requests,request,create,open,patch,creds,owner:session.user.id };
}
async function run(id,fn) { const start=Date.now(); try { const evidence=await fn(); cases.push({id,status:'PASS',milliseconds:Date.now()-start,evidence});console.log(`${id}: PASS`); } catch(error){ cases.push({id,status:'FAIL',milliseconds:Date.now()-start,error:String(error.stack)});console.log(`${id}: FAIL ${error.message}`); const p=contexts.at(-1)?.pages().at(-1); if(p) { writeFileSync(`${out}/${id}-failure.txt`,await p.locator('body').innerText().catch(()=>'')); } } finally { if(id !== 'F03') for(const c of contexts.splice(0)) await c.close(); } }
try {
 await run('F01',async()=>{
  const f=await fixture(),g=await f.create();
  // Synthetic recordStartDate fixture opens yesterday without claiming a real two-day trial.
  await pool.query("update goal set record_start_date=(record_start_date - interval '1 day')::date where id=$1 and user_id=$2",[g.id,f.owner]);
  await f.open(g);
  const prompt=f.page.locator('.fr-yesterday'); await prompt.getByRole('button',{name:'やった',exact:true}).click();
  await wait(()=>Promise.resolve(f.requests.length===1)); await f.page.getByRole('heading',{name:'昨日はどうでしたか？',exact:true}).waitFor({state:'hidden'});
  await f.page.getByRole('button',{name:/^やった/}).last().click();
  await f.page.getByText('今日は記録済みです',{exact:true}).waitFor();
  await f.page.getByRole('button',{name:/昨日.*の記録を変更/}).click();
  await f.page.getByRole('button',{name:'変更を保存',exact:true}).click();
  await wait(()=>Promise.resolve(f.requests.length===3));
  for(const req of f.requests) assert.deepEqual(req.body,{status:'DONE',amount:10,expectedGoalSettingsRevision:0});
  assert.notEqual(f.requests[0].path,f.requests[1].path); assert.equal(f.requests[0].path,f.requests[2].path);
  return f.requests;
 });
 await run('F02',async()=>{
  const f=await fixture(),g=await f.create();await f.open(g);
  const pattern=`**/api/goals/${g.id}/logs/*`; let first=true;
  await f.page.route(pattern,async route=>{ if(first){first=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'UNAVAILABLE',message:'synthetic'}})});}else await route.continue(); });
  await f.page.getByRole('button',{name:/^やった/}).last().click();await f.page.getByRole('button',{name:'もう一度保存',exact:true}).waitFor();
  await f.patch(g,{sessionAmount:100});
  await f.page.getByRole('button',{name:'もう一度保存',exact:true}).click();
  await f.page.getByText('Goalの設定が変更されました',{exact:true}).waitFor();
  assert.equal(f.requests.length,2);assert.deepEqual(f.requests[0],f.requests[1]);
  assert.deepEqual((await f.request('GET',`/api/goals/${g.id}/logs`)).json,[]);return f.requests;
 });
 let recovery;
 await run('F03',async()=>{
  const f=await fixture(),g=await f.create();await f.open(g);await f.patch(g,{sessionAmount:100});
  await f.page.getByRole('button',{name:/^やった/}).last().click();await f.page.getByText('Goalの設定が変更されました',{exact:true}).waitFor();
  assert.equal(await f.page.getByRole('button',{name:'この量で再保存'}).isDisabled(),true);
  const pattern=`**/api/goals/${g.id}?view=r11`;
  await f.page.route(pattern,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'UNAVAILABLE',message:'synthetic'}})}));
  await f.page.getByRole('button',{name:'最新の設定を取得'}).click();await f.page.getByText('最新の取得に失敗しました。まだ再保存できません。',{exact:true}).waitFor();
  assert.equal(await f.page.getByRole('button',{name:'この量で再保存'}).isDisabled(),true);assert.equal(await f.page.getByRole('button',{name:'選び直す',exact:true}).isDisabled(),true);
  assert.ok((await f.page.locator('body').innerText()).includes('10分'));assert.equal(f.requests.length,1);
  await f.page.screenshot({path:`${out}/F03.png`,fullPage:true});recovery={f,g,pattern};return f.requests;
 });
 await run('F04',async()=>{
  assert.ok(recovery,'F03 fixture required');const {f,g,pattern}=recovery;await f.page.unroute(pattern);
  await f.page.getByRole('button',{name:'最新の設定を取得'}).click();await wait(async()=>!(await f.page.getByRole('button',{name:'この量で再保存'}).isDisabled()));
  assert.equal(f.requests.length,1);await f.page.getByRole('button',{name:'この量で再保存'}).click();await f.page.getByText('今日は記録済みです',{exact:true}).waitFor();
  assert.deepEqual(f.requests[1].body,{status:'DONE',amount:10,expectedGoalSettingsRevision:1});
  assert.equal((await f.request('GET',`/api/goals/${g.id}/logs`)).json[0].amount,10);await f.page.screenshot({path:`${out}/F04.png`,fullPage:true});return f.requests;
 });
 await run('F05',async()=>{
  const evidence=[];
  for(const change of [{unit:'sessions'},{timezone:'UTC'}]){
   const f=await fixture(),g=await f.create();await f.open(g);await f.patch(g,change);
   await f.page.getByRole('button',{name:/^やった/}).last().click();await f.page.getByRole('button',{name:'最新の設定を取得'}).click();
   await f.page.getByText('単位またはタイムゾーンが変わりました。同じ数字を自動で保存せず、量と対象日を選び直してください。',{exact:true}).waitFor();
   assert.equal(await f.page.getByRole('button',{name:'この量で再保存'}).isDisabled(),true);assert.equal(await f.page.getByRole('button',{name:'選び直す',exact:true}).isDisabled(),false);
   assert.equal(f.requests.length,1);assert.ok((await f.page.locator('body').innerText()).includes('10分'));evidence.push({change,requests:f.requests});
  }return evidence;
 });
 let uncertain;
 await run('F06',async()=>{
  const f=await fixture();await f.page.goto(`${origin}/goals/new`);
  await f.page.locator('#goal-title').fill('応答切断Goal');await f.page.locator('#goal-totalRequired').fill('100');await f.page.locator('#goal-sessionAmount').fill('10');
  let committed;await f.page.route('**/api/goals',async route=>{ if(route.request().method()==='POST'){const response=await route.fetch();assert.equal(response.status(),201);committed=await response.json();await route.abort('failed');}else await route.continue(); });
  await f.page.getByRole('button',{name:'保存する',exact:true}).click();await f.page.getByRole('button',{name:'もう一度保存',exact:true}).waitFor();assert.ok(committed);
  assert.ok((await f.page.locator('body').innerText()).includes('作成結果を確認できませんでした'));
  await f.page.unroute('**/api/goals');await f.page.getByRole('link',{name:'閉じる',exact:true}).click();await f.page.goto(`${origin}/goals/new`);assert.equal(await f.page.locator('#goal-title').inputValue(),'応答切断Goal');
  await f.request('POST','/api/auth/sign-out',{});assert.equal((await f.request('POST','/api/auth/sign-in/email',f.creds)).status,200);
  await f.page.reload();assert.equal(await f.page.locator('#goal-title').inputValue(),'応答切断Goal');
  await f.page.screenshot({path:`${out}/F06.png`,fullPage:true});await f.page.getByRole('button',{name:'保存する',exact:true}).click();await f.page.waitForURL(`${origin}/goals`);
  assert.equal(f.requests.length,2);assert.deepEqual(f.requests[0],f.requests[1]);const list=(await f.request('GET','/api/goals')).json;assert.equal(list.length,1);assert.equal(list[0].id,committed.id);
  uncertain=f;return {requests:f.requests,goalId:committed.id};
 });
 await run('F07',async()=>{
  const f=await fixture();await f.page.goto(`${origin}/goals/new`);await f.page.locator('#goal-title').fill('Aの不明操作');await f.page.locator('#goal-totalRequired').fill('100');await f.page.locator('#goal-sessionAmount').fill('10');
  await f.page.route('**/api/goals',async route=>{if(route.request().method()==='POST'){await route.fetch();await route.abort('failed');}else await route.continue();});await f.page.getByRole('button',{name:'保存する',exact:true}).click();await f.page.getByRole('button',{name:'もう一度保存',exact:true}).waitFor();await f.page.unroute('**/api/goals');
  const old=f.requests[0];await f.request('POST','/api/auth/sign-out',{});assert.equal((await f.request('POST','/api/auth/sign-up/email',{name:'B',email:`${randomUUID()}@example.test`,password:'Synthetic-148-only-password!'})).status,200);
  await f.page.reload();await f.page.locator('#goal-title').waitFor();assert.equal(await f.page.locator('#goal-title').inputValue(),'');assert.equal(f.requests.length,1);
  const response=await f.request('POST','/api/goals',old.body,{'Idempotency-Key':old.key,'X-Create-Owner':f.owner});assert.equal(response.status,409);assert.equal(response.json.error.code,'CREATE_OWNER_CHANGED');assert.deepEqual((await f.request('GET','/api/goals')).json,[]);return {guardStatus:409,browserPostCount:f.requests.length};
 });
 await run('F08',async()=>{
  const f=await fixture();await f.page.goto(`${origin}/goals/new`);await f.page.locator('#goal-title').fill('422訂正');await f.page.locator('#goal-totalRequired').fill('100');await f.page.locator('#goal-sessionAmount').fill('10');
  await f.page.route('**/api/goals',route=>route.request().method()==='POST'?route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({error:{code:'VALIDATION_ERROR',message:'synthetic',fields:[{path:'body/title',message:'synthetic'}]}})}):route.continue());
  await f.page.getByRole('button',{name:'保存する',exact:true}).click();await wait(async()=>!(await f.page.locator('#goal-title').isDisabled()));assert.equal(f.requests.length,1);await f.page.unroute('**/api/goals');await f.page.locator('#goal-title').fill('訂正済み');await f.page.getByRole('button',{name:'保存する',exact:true}).click();await f.page.waitForURL(`${origin}/goals`);assert.notEqual(f.requests[0].key,f.requests[1].key);assert.equal((await f.request('GET','/api/goals')).json.length,1);return f.requests;
 });
 await run('F09',async()=>{
  const f=await fixture(),g=await f.create({initialProgress:10});await f.page.goto(`${origin}/goals/${g.id}/edit`);await f.page.locator('#goal-title').waitFor();assert.equal(await f.page.getByRole('button',{name:'回',exact:true}).isDisabled(),true);await f.page.getByText('過去の量や現在の初期量の意味を保つため、単位を変更できません。別単位は新しいGoalで始めてください。',{exact:true}).waitFor();assert.ok(await f.page.getByRole('link',{name:'新しいGoalを作成'}).count());return {unitDisabled:true,reasonAndNewGoal:true};
 });
 await run('F10',async()=>{
  const f=await fixture(),g=await f.create();await f.open(g);await f.page.route(`**/api/goals/${g.id}/today?view=r11`,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'UNAVAILABLE',message:'synthetic'}})}));
  await f.page.getByRole('button',{name:/^やった/}).last().click();await f.page.getByText('記録は保存しました',{exact:true}).waitFor();assert.equal(f.requests.length,1);assert.equal((await f.request('GET',`/api/goals/${g.id}/logs`)).json[0].amount,10);return f.requests;
 });
} finally {
 writeFileSync(`${out}/results.json`,JSON.stringify({level:'REAL_CHROME_SYNTHETIC_IMAGE',source:'current worktree image; Docker image ID in verification log',cases},null,2));
 for(const context of contexts)await context.close();await browser.close();await pool.end();
}
if(cases.some(c=>c.status!=='PASS'))process.exitCode=1;
