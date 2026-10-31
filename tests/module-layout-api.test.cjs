require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const {ticketWorkspace}=require('../src/lib/pos-layout.ts');
const {NextRequest}=require('next/server');
test('module layout API enforces authority, isolates businesses, versions saves and restores appearance without business-rule changes',async()=>{
 const original=Module._load,rows=new Map(),audits=[];let role='ADMIN',writes=0;
 const defaults={timingMode:'CONCURRENT',taxRate:8.25,showInactivePets:false,posLayout:ticketWorkspace(null),hoverFields:['time','pet'],hoverLabels:false,statusStyles:{'OPEN|VIP':{color:'#123456'}}};
 const key=(tenant,setting)=>tenant+'|'+setting;
 const tx={$queryRaw:async()=>[],tenantSetting:{
  findMany:async({where})=>[...rows.values()].filter(r=>r.tenantId===where.tenantId&&(where.settingKey.in?where.settingKey.in.includes(r.settingKey):r.settingKey.startsWith(where.settingKey.startsWith))),
  findUnique:async({where})=>structuredClone(rows.get(key(where.tenantId_settingKey.tenantId,where.tenantId_settingKey.settingKey))||null),
  upsert:async({where,create,update})=>{writes++;const k=key(where.tenantId_settingKey.tenantId,where.tenantId_settingKey.settingKey),row=rows.get(k);const next=structuredClone(row?{...row,...update}:create);rows.set(k,next);return next}
 }};const db={...tx,$transaction:async f=>f(tx)};
 const workflow={workflowDefaults:defaults,workflowSettings:async(t,client=db)=>structuredClone((await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:t,settingKey:'WORKFLOW'}}}))?.value||defaults),validateWorkflow:v=>({...v})};
 Module._load=function(id,...args){if(id==='@/src/lib/db')return {db};if(id==='@/src/lib/request-policy')return {withRequestPolicy:f=>f};if(id==='@/src/lib/employee-session')return {getActiveEmployeeSession:async()=>role?{user:{id:'employee',role}}:null};if(id==='@/src/lib/audit')return {writeAudit:async v=>audits.push(v)};if(id==='@/src/lib/workflow-settings'||id==='./workflow-settings')return workflow;if(id.startsWith('@/src/lib/'))return original.call(this,require('path').join(__dirname,'../src/lib',id.slice('@/src/lib/'.length)+'.ts'),...args);return original.call(this,id,...args)};
 let GET,PUT;try{({GET,PUT}=require('../app/api/module-layouts/route.ts'))}finally{Module._load=original}
 const request=(body,tenant='business')=>new NextRequest('http://localhost/api/module-layouts',{method:'PUT',headers:{'x-tenant-id':tenant,cookie:'groompro_session=session','Content-Type':'application/json'},body:JSON.stringify(body)});
 const save=(controls,extra={})=>PUT(request({module:'Calendar',device:'desktop',value:{controls},...extra}));
 role=null;assert.equal((await save({})).status,401);role='FRONT';assert.equal((await save({})).status,403);role='ADMIN';assert.equal((await save({date:{width:100}})).status,400);assert.equal(writes,0);
 role='DEVELOPER';let r=await save({date:{width:150,label:'Visit date'}});assert.equal(r.status,200);let d=await r.json();assert.equal(d.history.length,2);const initialId=d.history[0].id;
 role='ADMIN';r=await save({date:{label:'Booking date',color:'#abcdef'}});assert.equal(r.status,200);d=await r.json();assert.equal(d.value.controls.date.width,150);
 const beforeConflict=writes;r=await save({date:{label:'Stale'}},{expected:{controls:{}}});assert.equal(r.status,400);assert.equal(writes,beforeConflict);
 // A different business never receives this layout or its history.
 const foreign=await GET(new NextRequest('http://localhost/api/module-layouts?module=Calendar',{headers:{'x-tenant-id':'other',cookie:'groompro_session=session'}}));const foreignData=await foreign.json();assert.deepEqual(foreignData.layouts,{});assert.deepEqual(foreignData.history,[]);
 // Change appearance and record it, then restore the original visual snapshot.
 const changed={...defaults,timingMode:'SEQUENTIAL',statusStyles:{'OPEN|VIP':{color:'#abcdef'}},hoverFields:['customer']};rows.set(key('business','WORKFLOW'),{tenantId:'business',settingKey:'WORKFLOW',value:changed});await save({date:{label:'Newest'}});
 r=await save({date:{label:'Date'}},{restoreId:initialId});assert.equal(r.status,200);const restored=rows.get(key('business','WORKFLOW')).value;assert.deepEqual(restored.statusStyles,defaults.statusStyles);assert.deepEqual(restored.hoverFields,defaults.hoverFields);assert.equal(restored.timingMode,'SEQUENTIAL');assert.equal(restored.taxRate,8.25);
 for(let n=0;n<5;n++)assert.equal((await save({date:{label:'Version '+n}})).status,200);
 const history=rows.get(key('business','LAYOUT_HISTORY:MODULE:Calendar')).value;assert.equal(history.length,5);assert.equal(new Set(history.map(v=>v.id)).size,5);assert.ok(audits.every(a=>a.tenantId==='business'));assert.ok([...rows.values()].every(row=>row.tenantId==='business'));
});
