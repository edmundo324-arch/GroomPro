require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const start=new Date('2026-11-09T15:00:00Z');
const ticket=(id,role,name,user)=>({
 id,customerId:'customer',status:'CONFIRMED',scheduledStart:start,durationMin:60,timingMode:'CONCURRENT',
 pets:[{petId:id+'-pet',pet:{id:id+'-pet',name}}],
 lines:[{id:id+'-line',petId:id+'-pet',role,lineType:'SERVICE',description:role==='GROOM'?'Groom':'Full Wash',durationMin:60,quantity:1}],
 assignments:user?[{role:'PLANNED_GROOMER',userId:user}]:[],
});
test('coverage reviews first, excludes conflicts and time blocks, and rejects a changed plan before writing',async()=>{
 const Today=class extends Date{constructor(...args){super(...(args.length?args:['2026-11-07T15:00:00Z']))}static now(){return +new Date('2026-11-07T15:00:00Z')}};
 const exports={},writes=[],audits=[],tickets=[ticket('existing','GROOM','Busy dog','g1'),ticket('groom','GROOM','Fluffy','sick'),ticket('wash','BATH','Coco','sick')];
 const employees=[['g1','Groom'],['g2','Groom'],['w1','Bath'],['w2','Bath']].map(([id,jobTitle])=>({id,jobTitle,role:'BACK',firstName:id}));
 const tx={
  $queryRaw:async strings=>String(strings).includes('EmployeeSchedule')?employees.map(e=>({userId:e.id,dayOfWeek:1,startTime:'08:00',endTime:'17:00'})):[],
  tenantSetting:{findMany:async()=>[]},ticket:{findMany:async()=>tickets,update:async()=>{}},
  user:{findMany:async()=>employees},scheduleOverride:{findMany:async()=>[{resourceId:'sick',date:'2026-11-09',dayOff:true}]},
  auditEntry:{create:async entry=>audits.push(entry)},
 };
 const mock={
  '@prisma/client':{Prisma:{TransactionIsolationLevel:{Serializable:'Serializable',RepeatableRead:'RepeatableRead'}}},
  'next/server':{NextResponse:{json:(data,options)=>({data,status:options?.status||200})}},
  'platform-access':{platformSession:async()=>({tenantId:'tenant',user:{id:'manager',role:'MANAGER'}})},
  'request-policy':{withRequestPolicy:handler=>handler},'request-location':{requestLocation:async()=> 'shop'},
  db:{db:{location:{findFirst:async()=>({timezone:'America/Chicago'})},$transaction:callback=>callback(tx)}},
  'workflow-settings':{workflowSettings:async()=>({})},
  'calendar-blocks':{calendarBlocks:async()=>[{resourceKind:'employee',resourceId:'w1',start:start.toISOString(),end:'2026-11-09T16:00:00Z'}]},
  'line-time-store':{lineStartsKey:id=>'times:'+id},
  'planned-package-store':{plannedSettingKey:id=>'plans:'+id,writePlannedPackages:async(_tx,_tenant,id,plans)=>writes.push({id,plans})},
 };
 const load=name=>mock[name==='@prisma/client'||name==='next/server'?name:name.split('/').at(-1)]||require('../src/lib/'+name.split('/').at(-1)+'.ts');
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/calendar/coverage/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:load,Date:Today});
 const body={date:'2026-11-09',range:'day',employeeId:'sick'},request=(method,data)=>({method,json:async()=>data});
 const preview=await exports.POST(request('POST',body));
 assert.equal(preview.status,200);assert.deepEqual(Array.from(preview.data.proposals,p=>p.employeeId),['g2','w2']);
 const selectedDay=await exports.POST(request('POST',{date:'2026-11-09',range:'day'}));
 assert.equal(selectedDay.status,200);assert.deepEqual(Array.from(selectedDay.data.proposals,p=>p.employeeId),['g2','w2']);
 assert.equal(writes.length,0);
 const wrong=preview.data.proposals.map(p=>({...p,employeeId:'g1'}));
 assert.equal((await exports.PUT(request('PUT',{...body,proposals:wrong}))).status,409);assert.equal(writes.length,0);
 const applied=await exports.PUT(request('PUT',{...body,proposals:preview.data.proposals}));
 assert.equal(applied.data.assigned,2);assert.equal(audits.length,2);
 assert.deepEqual(writes.map(w=>w.plans[0].userId),['g2','w2']);
});
