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
  'request-policy':{withRequestPolicy:handler=>handler,hidePlatformOwners:async()=>false},'request-location':{requestLocation:async()=> 'shop'},
  db:{db:{location:{findFirst:async()=>({timezone:'America/Chicago'})},$transaction:callback=>callback(tx)}},
  'workflow-settings':{workflowSettings:async()=>({})},
  'employee-shift-location':{employeeLocationContext:async()=>({shift:()=> 'shop',date:()=> 'shop'})},
  'employee-arrival-capacity':{loadEmployeeArrivalCapacity:async()=>({configured:()=>false,reservations:[],allows:()=>true})},
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


function limitedCoverage(options={}){
 const {createEmployeeArrivalCapacity,ticketArrivalReservations}=require('../src/lib/employee-arrival-capacity.ts');
 const {assignmentApproval}=require('../src/lib/calendar-assignment-approval.ts');
 const employees=[{id:'g1',firstName:'Kandance',role:'GROOMER',jobTitle:'Groom',locationId:'shop'}],writes=[],locks=[];
 const make=(id,user,minute=0)=>({...ticket(id,'GROOM',id,user),locationId:'shop',scheduledStart:new Date(+start+minute*60000)});
 const existing=make('existing','g1');existing.durationMin=120;existing.lines[0].durationMin=120;
 const family=make('family',null);family.pets.push({petId:'family-second',pet:{id:'family-second',name:'Second Family Dog'}});family.lines.push({...family.lines[0],id:'family-second-line',petId:'family-second'});
 const third=make('third',null),later=make('later',null,30),late=make('approved-late',null,480);late.durationMin=120;late.lines[0].durationMin=120;
 const plans=[{petId:'approved-late-pet',userId:'g1',availabilityApproval:assignmentApproval(late,'approved-late-pet','g1')}];
 const tickets=[existing,family,third,later,late],settings=[{settingKey:'plans:approved-late',value:{items:plans}}];
 const tx={
  $queryRaw:async parts=>{const sql=parts.join('?');if(sql.includes('FOR UPDATE'))locks.push(sql);return sql.includes('EmployeeSchedule')?[{id:'shift',userId:'g1',dayOfWeek:1,startTime:'08:00',endTime:'17:00'}]:[]},
  tenantSetting:{findMany:async({where})=>where.settingKey.in?settings:[]},ticket:{findMany:async()=>tickets,update:async()=>{}},
  user:{findMany:async()=>employees},scheduleOverride:{findMany:async()=>options.off?[{resourceId:'g1',date:'2026-11-09',dayOff:true}]:[]},auditEntry:{create:async()=>{}},
 };
 const mock={
  '@prisma/client':{Prisma:{TransactionIsolationLevel:{Serializable:'Serializable',RepeatableRead:'RepeatableRead'}}},'next/server':{NextResponse:{json:(data,options)=>({data,status:options?.status||200})}},
  'platform-access':{platformSession:async()=>({tenantId:'tenant',user:{id:'manager',role:'MANAGER'}})},'request-policy':{withRequestPolicy:handler=>handler,hidePlatformOwners:async()=>false},'request-location':{requestLocation:async()=> 'shop'},
  db:{db:{location:{findFirst:async()=>({timezone:'America/Chicago'})},$transaction:fn=>fn(tx)}},'workflow-settings':{workflowSettings:async()=>({})},
  'employee-shift-location':{employeeLocationContext:async()=>({shift:()=>options.away?'other':'shop',date:()=> 'shop'})},
  'employee-arrival-capacity':{loadEmployeeArrivalCapacity:async()=>createEmployeeArrivalCapacity(new Map([['g1',{maxAppointments:2,intervalMinutes:30}]]),[...tickets.flatMap(t=>ticketArrivalReservations(t,t.id==='approved-late'?plans:[])),...(options.crossLocation?[{ticketId:'away',employeeId:'g1',locationId:'other',start:+start,end:+start+180*60000}]:[])])},
  'calendar-blocks':{calendarBlocks:async()=>options.blocked?[{resourceKind:'employee',resourceId:'g1',start:start.toISOString(),end:new Date(+start+180*60000).toISOString()}]:[]},
  'line-time-store':{lineStartsKey:id=>'times:'+id},'planned-package-store':{plannedSettingKey:id=>'plans:'+id,writePlannedPackages:async(_tx,_tenant,id,plans)=>writes.push({id,plans})},
 };
 const exports={},load=name=>mock[name==='@prisma/client'||name==='next/server'?name:name.split('/').at(-1)]||require('../src/lib/'+name.split('/').at(-1)+'.ts');
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/calendar/coverage/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:load,Date});
 const request=(method,proposals)=>({method,json:async()=>({date:'2026-11-09',range:'day',...(proposals?{proposals}: {})})});
 return {review:()=>exports.POST(request('POST')),apply:proposals=>exports.PUT(request('PUT',proposals)),writes,locks};
}

test('configured coverage allows overlapping family arrivals up to the limit and keeps approved late appointments',async()=>{
 const f=limitedCoverage(),review=await f.review();assert.equal(review.status,200);
 const rows=Array.from(review.data.proposals);assert.deepEqual(rows.filter(r=>r.employeeId).map(r=>r.petId),['family-pet','family-second','later-pet']);
 assert.equal(rows.find(r=>r.ticketId==='third').employeeId,'');assert.match(rows.find(r=>r.ticketId==='third').reason,/Employee arrival limit reached:.*2 family appointments every 30 minutes/);assert.equal(rows.some(r=>r.ticketId==='existing'||r.ticketId==='approved-late'),false);
 const applied=await f.apply(rows.filter(r=>r.employeeId));assert.equal(applied.data.assigned,3);assert.deepEqual(f.writes.map(w=>w.id),['family','later']);
 assert.match(f.locks[0],/FROM Tenant/);assert.match(f.locks[1],/FROM Location/);
});

test('configured coverage still respects days off, assigned shift location, time blocks, and cross-shop work',async()=>{
 for(const options of [{off:true},{away:true},{blocked:true},{crossLocation:true}]){
  const f=limitedCoverage(options),review=await f.review();assert.equal(review.status,200);assert.equal(review.data.proposals.filter(r=>r.employeeId).length,0,JSON.stringify(options));assert.equal(f.writes.length,0);
 }
});
