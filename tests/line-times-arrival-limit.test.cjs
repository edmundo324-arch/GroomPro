require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const guard=require('../src/lib/employee-arrival-validation.ts'),warnings=require('../src/lib/scheduling-warning.ts'),timing=require('../src/lib/pet-scheduling.ts');
function fixture(){
 const at=time=>new Date('2030-01-07T'+time+':00Z'),locks=[],audits=[],settings=new Map([['EMPLOYEE_ARRIVAL_LIMIT:g1',{maxAppointments:1,intervalMinutes:30}]]);
 const make=(id,start)=>({id,tenantId:'business',locationId:'shop',customerId:id,scheduledStart:at(start),durationMin:120,timingMode:'SEQUENTIAL',status:'OPEN',checkedInAt:null,assignments:[{role:'PLANNED_GROOMER',userId:'g1'}],lines:[{id:id+'-line',petId:id+'-dog',lineType:'SERVICE',role:'GROOM',quantity:1,durationMin:120,assignedUserId:null}]});
 let ticket=make('ticket','08:30'),other=make('other','09:00'),approve=false,authenticated=true;
 const tx={
  $queryRaw:async parts=>{const sql=parts.join('?');if(sql.includes('FOR UPDATE')){locks.push(sql);return []}return [{id:'ticket'},{id:'other'}]},
  ticket:{findFirst:async()=>structuredClone(ticket),findMany:async({where})=>[ticket,other].filter(t=>where.id.in.includes(t.id)).map(t=>structuredClone(t)),update:async({data})=>{Object.assign(ticket,data);return structuredClone(ticket)}},
  tenantSetting:{findMany:async({where})=>where.settingKey.in.filter(key=>settings.has(key)).map(settingKey=>({settingKey,value:structuredClone(settings.get(settingKey))}))},
  auditEntry:{create:async({data})=>audits.push(data)},
 };
 const db={$transaction:async fn=>{const before=structuredClone(ticket),saved=structuredClone(settings),count=audits.length;try{return await fn(tx)}catch(error){ticket=before;settings.clear();for(const [key,value] of saved)settings.set(key,value);audits.length=count;throw error}}};
 const dependencies={
  'employee-arrival-validation':guard,'scheduling-warning':warnings,'pet-scheduling':timing,
  'attendance-move':{recordAttendanceMove:async()=>{},attendanceDecisionDetails:()=>({})},'groomer-assignment':{employeeAvailable:async()=>true},'scheduling-authorization':{approvedScheduling:async()=>approve},
  'next/server':{NextResponse:{json:(data,options)=>({data,status:options?.status||200})}},db:{db},'request-policy':{withRequestPolicy:fn=>fn},'employee-session':{getActiveEmployeeSession:async()=>authenticated?{user:{id:'manager'}}:null},
  'line-time-store':{readLineStarts:async()=>settings.get('TICKET_LINE_STARTS:ticket')||{},writeLineStarts:async(_tx,_tenant,id,times)=>settings.set('TICKET_LINE_STARTS:'+id,times)},'location-hours':{appointmentHoursError:async()=>null},
 };
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/tickets/line-times/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,process:{env:{}},require:id=>dependencies[id==='next/server'?id:id.split('/').at(-1)]});
 return {at,locks,audits,settings,get ticket(){return ticket},setOther:time=>other.scheduledStart=at(time),checkIn:()=>{ticket.checkedInAt=at('08:25');ticket.status='CHECKED_IN';ticket.lines[0].assignedUserId='g1'},approve:()=>approve=true,signOut:()=>authenticated=false,
  move:time=>exports.PATCH({headers:{get:()=> 'business'},cookies:{get:()=>({value:'session'})},json:async()=>({ticketId:'ticket',lineId:'ticket-line',scheduledStart:at(time).toISOString()})})};
}
test('service-time planning rejects a full arrival interval atomically and permits continuing work after the interval',async()=>{
 const f=fixture(),before=+f.ticket.scheduledStart;
 const rejected=await f.move('09:00');assert.equal(rejected.status,409);assert.match(rejected.data.schedulingWarning,/Employee arrival limit reached/);
 assert.equal(+f.ticket.scheduledStart,before);assert.equal(f.settings.has('TICKET_LINE_STARTS:ticket'),false);assert.equal(f.audits.length,0);
 assert.match(f.locks[0],/FROM Tenant/);assert.match(f.locks[1],/FROM Ticket/);
 const accepted=await f.move('09:30');assert.equal(accepted.status,200);assert.equal(+f.ticket.scheduledStart,+f.at('09:30'));assert.equal(f.audits.length,1);
});
test('unchanged legacy arrivals remain editable and authorized arrival exceptions are preserved',async()=>{
 const f=fixture();f.setOther('08:30');assert.equal((await f.move('08:30')).status,200,'A lowered limit cannot invalidate an unchanged arrival');
 f.setOther('09:00');f.approve();assert.equal((await f.move('09:00')).status,200);assert.equal(+f.ticket.scheduledStart,+f.at('09:00'));
});
test('actual checked-in service timing stays separate from future arrival limits and still requires sign-in',async()=>{
 const f=fixture();f.checkIn();assert.equal((await f.move('09:00')).status,200);assert.equal(f.ticket.lines[0].assignedUserId,'g1');
 f.signOut();assert.equal((await f.move('10:00')).status,401);assert.equal(+f.ticket.scheduledStart,+f.at('09:00'));
});
