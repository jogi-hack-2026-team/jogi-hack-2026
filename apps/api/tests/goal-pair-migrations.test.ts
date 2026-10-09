import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,readdirSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {migrate} from '../src/db/migrate.ts';
import {createTestDatabase} from './helpers/database.ts';
const source=new URL('../migrations/',import.meta.url);
const names=readdirSync(source).filter(n=>/^\d{4}_[\w-]+\.sql$/.test(n)).sort();
for(const first of ['0005_goal_target_date.sql','0005_goal_data_integrity.sql']) test('163+175 migration: '+first+'を先に適用しても既存量・日付・metadata・台帳を保つ',async t=>{
 const db=await createTestDatabase();t.after(()=>db.close());const dir=mkdtempSync(join(tmpdir(),'futureroi-pair-migration-'));t.after(()=>{assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(basename(dir).startsWith('futureroi-pair-migration-'));rmSync(dir,{recursive:true,force:true});});
 const other=first.includes('target')?'0005_goal_data_integrity.sql':'0005_goal_target_date.sql';
 for(const name of names.filter(n=>n!==other))copyFileSync(new URL(name,source),join(dir,name));const url=pathToFileURL(dir+'/');await migrate(db.pool,'all',url);
 const owner='pair-'+randomUUID();await db.pool.query('insert into "user" (id,name,email,"emailVerified","createdAt","updatedAt") values ($1,$1,$2,false,now(),now())',[owner,owner+'@example.test']);
 const goal=(await db.pool.query("insert into goal(user_id,title,unit,total_required,session_amount,initial_progress,timezone,record_start_date) values($1,'既存英語','minutes',3000,25,1240,'Asia/Tokyo','2026-10-05') returning id",[owner])).rows[0];
 await db.pool.query("insert into action_log(goal_id,local_date,status,amount) values($1,'2026-10-05','DONE',25)",[goal.id]);
 if(first.includes('target'))await db.pool.query("update goal set target_date='2027-03-31' where id=$1",[goal.id]);else {await db.pool.query('update goal set unit_history_locked=true where id=$1',[goal.id]);await db.pool.query('insert into goal_create_operation(user_id,idempotency_key,request_hash,goal_id) values($1,$2,$3,$4)',[owner,randomUUID(),'a'.repeat(64),goal.id]);}
 const columns='title,unit,total_required,session_amount,initial_progress,timezone,record_start_date,created_at,updated_at';const before=(await db.pool.query('select '+columns+' from goal where id=$1',[goal.id])).rows[0];const logBefore=(await db.pool.query('select * from action_log where goal_id=$1',[goal.id])).rows;
 const ledgerBefore=first.includes('integrity')?(await db.pool.query('select * from goal_create_operation where goal_id=$1',[goal.id])).rows:null;
 copyFileSync(new URL(other,source),join(dir,other));const added=await migrate(db.pool,'app',url);assert.deepEqual(added.app?.applied,[other]);assert.deepEqual((await db.pool.query('select '+columns+' from goal where id=$1',[goal.id])).rows[0],before);assert.deepEqual((await db.pool.query('select * from action_log where goal_id=$1',[goal.id])).rows,logBefore);
 const extra=(await db.pool.query('select target_date::text as target,unit_history_locked,goal_settings_revision from goal where id=$1',[goal.id])).rows[0];assert.equal(extra.target,first.includes('target')?'2027-03-31':null);assert.equal(extra.unit_history_locked,true);assert.equal(extra.goal_settings_revision,0);
 if(ledgerBefore)assert.deepEqual((await db.pool.query('select * from goal_create_operation where goal_id=$1',[goal.id])).rows,ledgerBefore);
 assert.deepEqual((await db.pool.query('select name from schema_migrations order by name')).rows.map(r=>r.name),names);assert.deepEqual((await migrate(db.pool,'app',url)).app?.applied,[]);
});
