require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),path=require('node:path');
function fixture(options={}){
 const at=time=>new Date('2030-01-07T'+time+':00Z'),locks=[],audits=[],settings=new Map();
 const line=(id,petId,role,durationMin)=>({id,ticketId:'ticket',serviceId:id,petId,role,durationMin,lineType:'SERVICE',quantity:1,unitPriceCents:1000,discountCents:0,totalCents:1000,commissionCents:0,sortOrder:id==='early'?0:1,description:id,assignedUserId:null});
 let ticket={id:'ticket',tenantId:'business',locationId:'shop',customerId:'family',orderNumber:1,status:options.checkedIn?'CHECKED_IN':'OPEN',checkedInAt:options.checkedIn?at('08:25'):null,scheduledStart:at('08:30'),durationMin:150,timingMode:'SEQUENTIAL',pets:[{petId:'early-dog'},{petId:'late-dog'}],assignments:[{role:'PLANNED_GROOMER',userId:'g1'}],lines:[{...line('early','early-dog','PREP',30),packageId:options.offer?null:'early-package',sourceKey:options.offer?'offer-today:early':null},line('late','late-dog','GROOM',120)]};
 let other={...structuredClone(ticket),id:'other',customerId:'other-family',scheduledStart:at(options.otherStart||'09:00'),assignments:[{role:'PLANNED_GROOMER',userId:options.otherEmployee||'g1'}],lines:[line('other-line','other-dog','GROOM',120)]},approve=false;
 for(const id of ['g1','g2'])settings.set('EMPLOYEE_ARRIVAL_LIMIT:'+id,{maxAppointments:1,intervalMinutes:30});
 settings.set('TICKET_LINE_STARTS:ticket',{early:at('08:30').toISOString(),late:at('09:00').toISOString()});
 const matches=(item,where)=>Object.entries(where||{}).every(([key,value])=>key==='ticket'||(value&&typeof value==='object'&&'in' in value?value.in.includes(item[key]):item[key]===value));
 const copyLine=(item,include)=>item?structuredClone({...item,...(include?.ticket?{ticket}: {})}):null;
 const tx={
  $queryRaw:async parts=>{const sql=parts.join('?');if(sql.includes('FOR UPDATE')){locks.push(sql);return []}return [{id:'ticket'},{id:'other'}]},
  ticket:{findFirst:async({where})=>where.id===ticket.id&&where.tenantId==='business'?structuredClone(ticket):null,findMany:async({where})=>[ticket,other].filter(t=>where.id.in.includes(t.id)).map(t=>structuredClone(t)),update:async({data})=>{Object.assign(ticket,data);return structuredClone(ticket)}},
  ticketLine:{findFirst:async({where,include})=>copyLine(ticket.lines.find(l=>matches(l,where)),include),findMany:async()=>structuredClone(ticket.lines),create:async({data})=>{const created={...data,id:data.id||'new-line'};ticket.lines.push(created);return structuredClone(created)},update:async({where,data})=>{const current=ticket.lines.find(l=>l.id===where.id);Object.assign(current,data);return structuredClone(current)},delete:async({where})=>{ticket.lines=ticket.lines.filter(l=>l.id!==where.id)},deleteMany:async({where})=>{ticket.lines=ticket.lines.filter(l=>!matches(l,where))}},
  tenantSetting:{findMany:async({where})=>where.settingKey.in.filter(key=>settings.has(key)).map(settingKey=>({settingKey,value:structuredClone(settings.get(settingKey))})),findUnique:async({where})=>{const value=settings.get(where.tenantId_settingKey.settingKey);return value?{value:structuredClone(value)}:null},upsert:async({create,update})=>settings.set(create.settingKey,structuredClone(settings.has(create.settingKey)?update.value:create.value)),deleteMany:async()=>{}},
  location:{findFirst:async()=>({timezone:'UTC'})},pet:{findFirst:async({where})=>({id:where.id})},user:{findFirst:async({where})=>({id:where.id})},package:{findMany:async()=>[]},
  ticketPet:{findMany:async()=>structuredClone(ticket.pets),findFirst:async({where})=>ticket.pets.find(p=>p.petId===where.petId),upsert:async()=>{}},auditEntry:{create:async({data})=>audits.push(data)},
 };
 const db={...tx,$transaction:async fn=>{const before=structuredClone(ticket),saved=structuredClone(settings),count=audits.length;try{return await fn(tx)}catch(error){ticket=before;settings.clear();for(const [key,value] of saved)settings.set(key,value);audits.length=count;throw error}}};
 const dependencies={
  'employee-arrival-validation':require('../src/lib/employee-arrival-validation.ts'),'scheduling-warning':require('../src/lib/scheduling-warning.ts'),
  db:{db},'next/server':{NextResponse:{json:(data,options)=>({data,status:options?.status||200})}},'request-policy':{withRequestPolicy:fn=>fn},'employee-session':{getActiveEmployeeSession:async()=>({user:{id:'staff'}})},
  'attendance-move':{recordAttendanceMove:async()=>{},attendanceDecisionDetails:()=>({})},'scheduling-authorization':{approvedScheduling:async()=>approve},'location-hours':{appointmentHoursError:async()=>null},
  'groomer-assignment':{employeeAvailable:async()=>true,syncActualGroomers:async()=>{}},'grooming-notes-store':{ensureGroomingNotes:async()=>{}},'appointment-pet-store':{syncAppointmentPets:async()=>{}},
  'rebooking-discount-store':{refreshRebookingDiscounts:async()=>{}},'offline-transaction':{offlineLineId:()=> 'new-line'},'audit':{writeAudit:async entry=>audits.push(entry)},'pricing':{getServicePrice:async()=>({finalPriceCents:1000})},
  'workflow-settings':{workflowSettings:async()=>({posLayout:{}})},'pos-layout':{ticketWorkspace:()=>({packageRemovalPolicy:'KEEP_DISCOUNT'})},'planned-package-store':{readPlannedPackages:async()=>[],writePlannedPackages:async()=>{}},
  'pos-lines':{resolveSaleLines:async(_tx,_tenant,items)=>({lines:items.map(item=>({...line('new-line',item.petId,item.role||'ADD_ON',30),assignedUserId:item.assignedUserId||null,sortOrder:2}))})},
 };
 const cache=new Map(),compiled=new Set(['line-time-store','remove-ticket-line','pet-ticket-items-store','offer-today-lines']);
 function load(id){if(id==='next/server')return dependencies[id];const name=id.split('/').at(-1);if(name in dependencies)return dependencies[name];if(compiled.has(name)){if(!cache.has(name))cache.set(name,compile('src/lib/'+name+'.ts'));return cache.get(name)}return require(path.resolve('src/lib',name+'.ts'))}
 function compile(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Error,process,require:load});return exports}
 const api=compile('app/api/ticket-lines/route.ts'),packages=compile('app/api/tickets/package/route.ts');
 const request=(body={},params={})=>({headers:{get:name=>name==='x-tenant-id'?'business':null},cookies:{get:()=>({value:'session'})},json:async()=>body,nextUrl:{searchParams:new URLSearchParams(params)}});
 return {at,locks,audits,settings,get ticket(){return ticket},approve:()=>approve=true,
  remove:kind=>kind==='package'?packages.POST(request({ticketId:'ticket',petId:'early-dog',packageId:'early-package',present:false})):kind==='offer'?api.POST(request({ticketId:'ticket',petId:'early-dog',type:'SERVICE',id:'early',offerToday:true,present:false})):kind==='pet'?api.DELETE(request({lineIds:['early']},{ticketId:'ticket',petId:'early-dog'})):api.DELETE(request({},{lineId:kind==='late'?'late':'early'})),
  add:()=>api.POST(request({ticketId:'ticket',petId:'early-dog',type:'SERVICE',id:'new-service',assignedUserId:'g2'})),
  assign:()=>api.PATCH(request({lineId:'early',assignedUserId:'g2'})),
 };
}

test('removing the earliest timed package, offer, service, or dog checks the new family arrival and rolls back fully',async()=>{
 for(const kind of ['package','offer','single','pet']){
  const f=fixture({offer:kind==='offer'}),before=JSON.stringify(f.ticket),times=JSON.stringify(f.settings.get('TICKET_LINE_STARTS:ticket'));
  const response=await f.remove(kind);assert.equal(response.status,409,kind+': '+JSON.stringify(response.data));assert.match(response.data.schedulingWarning,/Employee arrival limit reached/);
  assert.equal(JSON.stringify(f.ticket),before,kind+' ticket rollback');assert.equal(JSON.stringify(f.settings.get('TICKET_LINE_STARTS:ticket')),times,kind+' times rollback');assert.equal(f.audits.length,0);
  assert.match(f.locks[0],/FROM Tenant/);assert.match(f.locks[1],/FROM Ticket/);
  f.approve();assert.equal((await f.remove(kind)).status,200,kind+' approved exception');assert.equal(+f.ticket.scheduledStart,+f.at('09:00'));assert.deepEqual(f.ticket.lines.map(l=>l.id),['late']);
 }
});

test('new employee arrivals introduced by adding or editing an unchecked-in service respect the limit',async()=>{
 for(const method of ['add','assign']){
  const f=fixture({otherStart:'08:30',otherEmployee:'g2'}),before=JSON.stringify(f.ticket),response=await f[method]();
  assert.equal(response.status,409,method+': '+JSON.stringify(response.data));assert.match(response.data.schedulingWarning,/Employee arrival limit reached/);assert.equal(JSON.stringify(f.ticket),before);assert.equal(f.audits.length,0);
 }
});

test('unchanged existing arrivals and checked-in service work are preserved',async()=>{
 const existing=fixture({otherStart:'08:30'});assert.equal((await existing.remove('late')).status,200);assert.equal(+existing.ticket.scheduledStart,+existing.at('08:30'));
 for(const kind of ['package','offer','single','pet']){
  const f=fixture({checkedIn:true,offer:kind==='offer'}),response=await f.remove(kind);assert.equal(response.status,200,kind+': '+JSON.stringify(response.data));assert.equal(+f.ticket.scheduledStart,+f.at('09:00'));
 }
 const actual=fixture({checkedIn:true,otherStart:'08:30',otherEmployee:'g2'});assert.equal((await actual.assign()).status,200);assert.equal(actual.ticket.lines[0].assignedUserId,'g2');
});
