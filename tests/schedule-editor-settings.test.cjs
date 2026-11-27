require('./load-ts.cjs');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),test=require('node:test'),assert=require('node:assert/strict');
const {scheduleEditorDate,scheduleEditorDateFormat}=require('../src/lib/schedule-editor-date.ts');
test('schedule editor defaults to named months with correct ordinal dates and preserves ISO on request',()=>{
 assert.equal(scheduleEditorDateFormat(undefined),'LONG');
 for(const [day,suffix] of [[1,'st'],[2,'nd'],[3,'rd'],[4,'th'],[11,'th'],[12,'th'],[13,'th'],[21,'st'],[22,'nd'],[23,'rd'],[27,'th'],[31,'st']])assert.equal(scheduleEditorDate('2026-11-'+String(day).padStart(2,'0')),`November ${day}${suffix}, 2026`);
 assert.equal(scheduleEditorDate('2026-11-27','ISO'),'2026-11-27');
 assert.throws(()=>scheduleEditorDateFormat('MDY'),/Choose Month Day Year/);
});

const load=(file,dependencies)=>{const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>Object.hasOwn(dependencies,id)?dependencies[id]:require(path.resolve(path.dirname(file),id)),exports);return exports};
test('tenant date-format choice saves and reloads without changing schedules, appointments or access rules',async()=>{
 const workflow=load('src/lib/workflow-settings.ts',{'./db':{db:{}},'./manufacturer-colors':{manufacturerColors:async()=>({})}});
 let stored={...workflow.workflowDefaults},role='ADMIN',timingWrites=0;const audits=[];
 const tx={$queryRaw:async()=>[],tenantSetting:{findUnique:async()=>null,upsert:async({where,update})=>{assert.equal(where.tenantId_settingKey.tenantId,'business');stored=structuredClone(update.value)}}};
 const read=async tenant=>{assert.equal(tenant,'business');return structuredClone(stored)};
 const handlers=load('app/api/workflow-settings/route.ts',{
  '@/src/lib/module-layout-snapshot':{moduleLayoutSnapshot:async(_tx,_tenant,_module,s)=>({ticket:{desktop:s.posLayout.desktop,phone:s.posLayout.phone}}),recordModuleLayout:async()=>{throw Error('Date formatting changed appointment layout')},calendarAppearanceKeys:[]},
  '@/src/lib/visual-layout':{layoutEqual:(a,b)=>JSON.stringify(a)===JSON.stringify(b),preserveTicketSizes:()=>{}},
  '@/src/lib/business-ticket-timing':{applyBusinessTiming:async()=>{timingWrites++;return 0}},
  '@/src/lib/visual-layout-store':{saveLayoutVersion:async()=>[]},
  '@/src/lib/pos-layout':require('../src/lib/pos-layout.ts'),
  '@/src/lib/request-policy':{withRequestPolicy:handler=>handler},
  '@/src/lib/platform-access':{isPlatformAdmin:()=>false},
  '@/src/lib/appearance-settings':{employeeAppearance:read,mayPersonalize:()=>false},
  'next/server':{NextResponse:{json:(data,options)=>({data,status:options?.status||200})}},
  '@/src/lib/db':{db:{$transaction:callback=>callback(tx)}},
  '@/src/lib/workflow-settings':{workflowSettings:read,validateWorkflow:workflow.validateWorkflow},
  '@/src/lib/employee-session':{getActiveEmployeeSession:async()=>({user:{id:'owner',role}})},
  '@/src/lib/audit':{writeAudit:async data=>audits.push(data)},
 });
 const request=body=>({headers:{get:key=>key==='x-tenant-id'?'business':null},cookies:{get:()=>({value:'session'})},nextUrl:{searchParams:new URLSearchParams()},json:async()=>body});
 for(const format of ['ISO','LONG']){
  const saved=await handlers.PUT(request({scheduleEditorOnly:true,scheduleEditorDateFormat:format}));assert.equal(saved.status,200);assert.equal(saved.data.changedTickets,0);
  const reopened=await handlers.GET(request());assert.equal(reopened.data.businessSettings.scheduleEditorDateFormat,format);
 }
 assert.equal(timingWrites,0);assert.equal(audits.length,2);assert.deepEqual(stored.vipBillingDays,workflow.workflowDefaults.vipBillingDays);
 assert.equal((await handlers.PUT(request({scheduleEditorOnly:true,scheduleEditorDateFormat:'invalid'}))).status,400);
 role='FRONT';assert.equal((await handlers.PUT(request({scheduleEditorOnly:true,scheduleEditorDateFormat:'ISO'}))).status,403);
 assert.equal(stored.scheduleEditorDateFormat,'LONG');
});
