require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {ticketDuration}=require('../src/lib/ticket-timing.ts');
const warnings=require('../src/lib/scheduling-warning.ts');
const copy=value=>structuredClone(value);

function fixture(options={}){
 const ticket={id:'ticket',tenantId:'shop',customerId:'family',locationId:'old-location',status:'OPEN',orderNumber:57,scheduledStart:new Date('2026-12-01T15:00:00Z'),durationMin:50,timingMode:'SEQUENTIAL'};
 const original={id:'line',ticketId:'ticket',petId:'dog',role:'ADD_ON',description:'Bath',quantity:1,unitPriceCents:5000,discountCents:0,totalCents:5000,durationMin:30,commissionPct:10,commissionCents:500,assignedUserId:'old-worker',assignedAt:new Date('2026-11-25T12:00:00Z'),sortOrder:0,ticket,service:{durationMin:30}};
 const synced={...original,description:'Bath After Catalog Update',quantity:2,unitPriceCents:7000,discountCents:500,totalCents:13500,durationMin:90,commissionPct:20,commissionCents:2700,role:'GROOM',assignedUserId:'latest-worker',sortOrder:4,ticket:{...ticket,locationId:'new-location',durationMin:200,scheduledStart:new Date('2026-12-02T16:00:00Z')},...options.current};
 const sibling={id:'sibling',ticketId:'ticket',quantity:1,durationMin:20,lineType:'SERVICE'};
 let locked=false,current=copy(original);const writes=[],audits=[],availability=[],hours=[],timing=[],groomers=[];
 const checkLock=()=>assert.equal(locked,true,'Ticket details must be checked after obtaining its lock');
 const tx={
  $queryRaw:async(strings,...values)=>{assert.match(strings.join('?'),/SELECT id FROM Ticket WHERE id=\? AND tenantId=\? FOR UPDATE/);assert.deepEqual(values,['ticket','shop']);locked=true;current=copy(synced);return [{id:'ticket'}]},
  ticketLine:{
   findFirst:async({where})=>{checkLock();assert.equal(where.id,'line');assert.equal(where.ticketId,'ticket');assert.equal(where.ticket.tenantId,'shop');return options.deleted?null:copy(current)},
   findMany:async({where})=>{checkLock();assert.equal(where.ticketId,'ticket');return [copy(current),copy(sibling)]},
   update:async({where,data})=>{checkLock();assert.equal(where.id,'line');writes.push(copy(data));current={...current,...copy(data)};return copy(current)}
  },
  ticketPet:{findFirst:async({where})=>{checkLock();assert.equal(where.ticketId,'ticket');return options.missingPet?null:{petId:where.petId}}},
  user:{findFirst:async({where})=>{checkLock();assert.equal(where.tenantId,'shop');assert.equal(where.active,true);return options.missingEmployee?null:{id:where.id}}},
  ticket:{update:async({data})=>{checkLock();timing.push(copy(data));return data}}
 };
 const db={ticketLine:{findFirst:async()=>copy(original)},$transaction:async fn=>{const length=writes.length;try{return await fn(tx)}catch(error){writes.length=length;throw error}}};
 const dependencies={
  'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},
  '@/src/lib/db':{db},
  '@/src/lib/employee-session':{getActiveEmployeeSession:async()=>({user:{id:'staff'}})},
  '@/src/lib/request-policy':{withRequestPolicy:handler=>handler},
  '@/src/lib/scheduling-warning':warnings,
  '@/src/lib/scheduling-authorization':{approvedScheduling:async()=>options.override===true},
  '@/src/lib/attendance-move':{attendanceDecisionDetails:error=>error?.attendanceDecision?{attendanceDecision:error.attendanceDecision}:{}},
  '@/src/lib/ticket-timing':{ticketDuration},
  '@/src/lib/groomer-assignment':{employeeAvailable:async(...args)=>{checkLock();availability.push(args);return options.unavailable!==true},syncActualGroomers:async(_tx,id)=>{checkLock();groomers.push(id)}},
  '@/src/lib/location-hours':{appointmentHoursError:async(...args)=>{checkLock();hours.push(args);return options.hoursError||null}},
  '@/src/lib/line-time-store':{ticketTiming:async(_tx,live,lines)=>{checkLock();assert.equal(live.locationId,'new-location');if(options.attendanceDecision)throw Object.assign(Error('Confirm the new appointment time.'),{attendanceDecision:options.attendanceDecision});return {durationMin:ticketDuration(lines,live.timingMode)}}},
  '@/src/lib/audit':{writeAudit:async data=>audits.push(copy(data))}
 };
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/ticket-lines/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Error,process,require:name=>{if(name in dependencies)return dependencies[name];if(name.startsWith('@/src/lib/'))return {};throw Error(name)}});
 const request=body=>({headers:{get:name=>name==='x-tenant-id'?'shop':null},cookies:{get:()=>({value:'session'})},json:async()=>({lineId:'line',...body})});
 return {api:exports,request,writes,audits,availability,hours,timing,groomers,current:()=>current};
}

test('employee-only edits preserve catalog values committed while waiting for the ticket lock',async()=>{
 const f=fixture(),response=await f.api.PATCH(f.request({assignedUserId:'new-worker'}));
 assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(f.writes.length,1);
 const line=response.body.line;assert.equal(line.assignedUserId,'new-worker');assert.equal(line.unitPriceCents,7000);assert.equal(line.quantity,2);assert.equal(line.discountCents,500);assert.equal(line.durationMin,90);assert.equal(line.totalCents,13500);assert.equal(line.commissionCents,2700);assert.equal(line.sortOrder,4);assert.equal(line.role,'GROOM');
 assert.deepEqual(f.availability[0].slice(0,3),['shop','new-worker','new-location']);assert.equal(+f.availability[0][3],+new Date('2026-12-02T16:00:00Z'));assert.equal(f.availability[0][4],200);assert.equal(f.hours[0][3],200);assert.equal(f.timing[0].durationMin,200);assert.deepEqual(f.groomers,['ticket']);
 assert.equal(f.audits[0].details.before.unitPriceCents,7000);assert.equal(f.audits[0].details.before.assignedUserId,'latest-worker');assert.match(f.audits[0].summary,/Bath After Catalog Update/);
});

test('explicit changes apply while every omitted field comes from the current line',async()=>{
 const f=fixture(),response=await f.api.PATCH(f.request({quantity:3,durationMin:45,unitPriceCents:8000}));
 assert.equal(response.status,200);assert.equal(response.body.line.totalCents,23500);assert.equal(response.body.line.commissionCents,4700);assert.equal(response.body.line.discountCents,500);assert.equal(response.body.line.assignedUserId,'latest-worker');assert.equal(response.body.line.sortOrder,4);assert.equal(f.timing[0].durationMin,155);assert.equal(f.availability.length,0);
});

test('closed, removed, or newly protected lines are rejected after acquiring the lock',async()=>{
 const cases=[{options:{deleted:true},body:{assignedUserId:'new-worker'},status:404,error:/could not be found/},{options:{current:{ticket:{status:'CLOSED'}}},body:{assignedUserId:'new-worker'},status:409,error:/closed/},{options:{current:{description:'Customer Account Balance'}},body:{assignedUserId:'new-worker'},status:409,error:/customer account/},{options:{},body:{role:'BATH'},status:400,error:/workflow roles stay fixed/},{options:{missingPet:true},body:{petId:'other-dog'},status:400,error:/selected dog/},{options:{missingEmployee:true},body:{assignedUserId:'inactive-worker'},status:404,error:/Assigned employee/}];
 for(const c of cases){const f=fixture(c.options),response=await f.api.PATCH(f.request(c.body));assert.equal(response.status,c.status);assert.match(response.body.error,c.error);assert.equal(f.writes.length,0);assert.equal(f.audits.length,0)}
});

test('fresh scheduling checks retain warning responses and approved exceptions',async()=>{
 for(const options of [{unavailable:true},{hoursError:'This location is closed on Wednesday.'}]){
  const f=fixture(options),response=await f.api.PATCH(f.request({assignedUserId:'new-worker'}));
  assert.equal(response.status,409);assert.equal(response.body.schedulingWarning,response.body.error);assert.equal(f.writes.length,0);
  const permitted=fixture({...options,override:true}),allowed=await permitted.api.PATCH(permitted.request({assignedUserId:'new-worker'}));assert.equal(allowed.status,200);assert.equal(permitted.writes.length,1);
 }
});

test('attendance confirmation decisions retain their response and roll back line edits',async()=>{
 const f=fixture({attendanceDecision:{ticketId:'ticket'}}),response=await f.api.PATCH(f.request({durationMin:60}));
 assert.equal(response.status,409);assert.deepEqual(response.body.attendanceDecision,{ticketId:'ticket'});assert.equal(f.writes.length,0);assert.equal(f.audits.length,0);
});
