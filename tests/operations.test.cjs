const test=require('node:test'),assert=require('node:assert/strict');
const Ops=require('../assets/js/operations-core.js');const C=require('../assets/js/core.js');const {makeHarness}=require('./dom-harness.cjs');
const KEY='tracklyMidnightCleanV2',OWNER='tracklyCloudSyncedUser',BASE='trackersCloudBaseAtV2';
const seed=()=>({sites:[{id:'s1',siteName:'Site <uji>',projectId:'p1',siteId:'TEST-001',client:'Client',tenant:'Tenant',region:'Jawa',workType:'PERKUATAN',status:'In Progress',tasks:[],finance:{rows:[]},oneflux:[],bast:[],pln:{}}],clients:[],tenants:[],activities:[],rules:[],notes:[],bastProcesses:[],pinned:[],theme:'light'});
async function load(extra={},opts={}){const h=makeHarness({[KEY]:JSON.stringify(seed()),...extra},opts);await h.flush();if(!opts.session)h.run("currentAccessProfile={role:'owner',access_enabled:true};trackersUpdateRoleUI()");return h;}
const input=(el,value)=>{el.value=value;el.dispatchEvent({type:'input'});};
test('reminders use separate due dates, H-3 boundary and ignore completed/archived work',()=>{
 const s={id:'s',siteName:'Demo',tasks:[{id:'a',title:'Late',dueDate:'2026-09-20'},{id:'b',title:'Today',dueDate:'2026-09-22'},{id:'c',title:'H3',dueDate:'2026-09-25'},{id:'d',title:'Far',dueDate:'2026-09-26'},{id:'e',title:'Legacy',date:'2020-01-01'},{id:'f',title:'Done',dueDate:'2020-01-01',status:'Completed'}],finance:{dueDate:'2026-09-22'},oneflux:[{required:true,status:'OK'},{required:true,status:'NOK'}]};
 const docs=[{id:'d1',status:'Draft'},{id:'d2',status:'Disetujui',total:1e9},{id:'d3',status:'Terbayar'}];
 const rows=Ops.reminders([s,{...s,id:'archive',archived:true}],docs,'2026-09-22',()=>({receivable:5e9}),()=>false);
 assert.equal(rows.filter(r=>r.type==='task').length,3);assert.equal(rows[0].title,'Late');assert.equal(rows.find(r=>r.type==='payment').amount,5e9);assert.equal(rows.filter(r=>r.type==='pkbon').length,1);assert.match(rows.find(r=>r.type==='document').title,/1 dokumen/);
 assert.equal(Ops.reminders([{...s,tasks:[],oneflux:[]}],[],'2026-09-22',()=>({receivable:0}),()=>false).length,0);assert.equal(Ops.days('2026-12-31','2027-01-01'),1);
});
test('audit captures deletes, old/new money and PKBON changes but ignores preferences',()=>{
 const old={trackly:{sites:[{id:'s',siteName:'Demo',finance:{rows:[{clientPrice:3000}]}}],notes:[{id:'n',title:'Old'}],theme:'light'},pkbon:{pkbon_history:[{id:'p',pkbonNo:'001',total:3000}]}};
 const next=structuredClone(old);next.trackly.sites[0].finance.rows[0].clientPrice=3e9;next.trackly.notes=[];next.trackly.theme='midnight';next.pkbon.pkbon_history[0].total=3e9;
 const changes=Ops.diffEntities(old,next);assert.equal(changes.length,3);assert.equal(changes[0].fields[0].before.rows[0].clientPrice,3000);assert.equal(changes[0].fields[0].after.rows[0].clientPrice,3e9);assert.equal(changes[1].action,'Hapus');assert.equal(changes[2].entity,'pkbon_history');
});
test('task due date persists separately from execution date and clears correctly',async()=>{
 const h=await load();h.run("openDetail('s1')");h.fire('manageTasks');input(h.el('newTaskTitle'),'Survey');input(h.el('newTaskDate'),'2026-09-01');input(h.el('newTaskDueDate'),'2026-09-25');h.fire('addTask');h.fire('saveTasks');
 let saved=C.decodeStored(h.context.localStorage.getItem(KEY));assert.equal(saved.sites[0].tasks[0].dueDate,'2026-09-25');assert.equal(saved.sites[0].tasks[0].date,'2026-09-01');assert.ok(saved.auditTrail[0].changes.some(c=>c.fields.some(f=>f.field==='tasks')));
 const reload=await load({[KEY]:JSON.stringify(saved)});reload.run("openDetail('s1')");reload.fire('manageTasks');input(reload.el('taskEditor').querySelector('[data-task-due]'),'');reload.fire('saveTasks');saved=C.decodeStored(reload.context.localStorage.getItem(KEY));assert.equal(saved.sites[0].tasks[0].dueDate,'');
});
test('finance deadline and billions persist and feed a complete report',async()=>{
 const h=await load();h.run("openDetail('s1');openFinance()");input(h.el('financeSections').querySelector('[data-fin-price]'),'3333333333');input(h.el('financeDueDate'),'2026-09-22');h.fire('saveFinance');
 const saved=C.decodeStored(h.context.localStorage.getItem(KEY));assert.equal(saved.sites[0].finance.dueDate,'2026-09-22');assert.equal(saved.sites[0].finance.rows[0].clientPrice,3333333333);
 const rows=h.run("opsReportRows(site('s1'))");assert.equal(rows.find(r=>r[0]==='Harga pekerjaan')[1],3333333333);assert.ok(rows.some(r=>r[0]==='DOKUMEN ONEFLUX'));assert.ok(rows.some(r=>r[0]==='PKBON'));assert.ok(rows.some(r=>r[0]==='TAHAP BAST'));h.fire('siteReportExcel');
});
test('invalid due date cannot overwrite saved task data',async()=>{
 const h=await load();h.run("openDetail('s1')");h.fire('manageTasks');input(h.el('newTaskTitle'),'Invalid');input(h.el('newTaskDueDate'),'2026-02-31');h.fire('addTask');assert.equal(h.run('taskDraft.length'),0);assert.match(h.el('toast').textContent,/Tenggat tidak valid/);
});
test('viewer can open reminders/export but cannot persist a change',async()=>{
 const h=await load();h.run("currentAccessProfile={role:'viewer',access_enabled:true};trackersUpdateRoleUI();openDetail('s1')");assert.equal(h.el('addSiteBtn').disabled,true);assert.equal(h.el('saveFinance').disabled,true);const before=h.context.localStorage.getItem(KEY);assert.throws(()=>h.run("state.sites[0].siteName='forbidden';save()"),/READ_ONLY/);assert.equal(h.context.localStorage.getItem(KEY),before);h.fire('notificationBtn');assert.equal(h.el('notificationModal').classList.contains('open'),true);assert.equal(h.el('siteReportExcel').disabled,false);assert.equal(h.el('resetPasswordSubmit')?.disabled||false,false);
});
test('shared-workspace identity isolates existing personal local data before switching',async()=>{
 const current=seed();const h=await load({[OWNER]:'member',[BASE]:'old-base',[KEY]:JSON.stringify(current)},{session:{user:{id:'member',email:'m@example.test'}},role:'project_manager',workspaceOwner:'owner'});
 assert.equal(h.context.localStorage.getItem(OWNER),'member:owner');assert.ok(h.context.localStorage.getItem('trackersAccount:member'));assert.equal(h.requests.filter(r=>r.name==='trackers_save_state').length,0);assert.equal(h.context.reloaded,true);
});
test('viewer never performs first upload into an empty workspace',async()=>{
 const h=await load({}, {session:{user:{id:'viewer'}},role:'viewer',workspaceOwner:'owner'});assert.equal(h.requests.filter(r=>r.name==='trackers_save_state').length,0);
});
