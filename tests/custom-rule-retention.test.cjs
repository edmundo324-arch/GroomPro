require('./load-ts.cjs');const test=require('node:test'),assert=require('node:assert/strict');
const {overdueCustomerRule}=require('../src/lib/custom-rule-retention.ts');
const {ticketCustomRule,customLifecyclePlans}=require('../src/lib/custom-rule-ticket-plan.ts');
function fixture(){
 const now=new Date('2030-02-12T18:00:00Z');let weeks=null,future=null,latestId='t',vip=false;
 const ticket={id:'t',tenantId:'tenant',customerId:'customer',locationId:'shop',status:'CLOSED',closedAt:new Date('2030-01-01T18:00:00Z'),location:{timezone:'America/Chicago'},customer:{active:true},pets:[{pet:{name:'Gizmo',active:true,customerId:'customer'}}],lines:[{lineType:'SERVICE',petId:'dog',role:'GROOM'}]};
 const rule={id:'00000000-0000-4000-8000-000000000001',revision:1,name:'Come back',priority:1,event:'CUSTOMER_OVERDUE',state:'ACTIVE',activatedAt:'2029-01-01',existingRecords:'INCLUDE',delayMinutes:0,locationIds:[],conditions:{vip:'ANY',upcoming:'ANY',attendance:'ANY',tagIds:[]},actions:[{id:'00000000-0000-4000-8000-000000000002',kind:'MESSAGE',title:'We miss Gizmo',body:'Book another visit.',assigneeIds:[],channels:['EMAIL']}]};
 const client={ticket:{findFirst:async q=>{assert.equal(q.where.tenantId,'tenant');return q.where.status==='CLOSED'?{...ticket,id:latestId}:future}},tenantSetting:{findMany:async()=>[{value:rule}],findUnique:async q=>q.where.tenantId_settingKey.settingKey==='CUSTOMER_RETENTION_WEEKS'&&weeks!==null?{value:weeks}:null},$queryRaw:async()=>vip?[{id:'vip'}]:[]};
 return {now,ticket,rule,client,weeks:v=>weeks=v,future:v=>future=v,latest:v=>latestId=v,vip:v=>vip=v,plan:()=>overdueCustomerRule(client,ticket,[rule],now)};
}
test('overdue rule uses six-week local due date and tenant retention interval',async()=>{const f=fixture(),p=await f.plan();assert.equal(p.ready,true);assert.equal(p.eventId,'customer-overdue:t');assert.equal(p.eventAt.toISOString(),'2030-02-12T06:00:00.000Z');f.weeks(8);assert.equal(await f.plan(),null)});
test('all booking channels, pending requests and a newer visit suppress old invitations',async()=>{for(const source of ['PHONE','ONLINE','STAFF']){const f=fixture();f.future({source,bookingDecision:source==='ONLINE'?'REQUESTED':'ACCEPTED'});assert.equal(await f.plan(),null)}const f=fixture();f.latest('new-visit');assert.equal(await f.plan(),null)});
test('inactive customers and pets or transferred dogs cannot receive an old-family invitation',async()=>{for(const change of [f=>f.ticket.customer.active=false,f=>f.ticket.pets[0].pet.active=false,f=>f.ticket.pets[0].pet.customerId='other']){const f=fixture();change(f);assert.equal(await f.plan(),null)}});

test('current ownership and customer state are reloaded instead of trusting an earlier message snapshot',async()=>{for(const changed of ['owner','inactive']){const f=fixture(),original=f.client.ticket.findFirst;f.client.ticket.findFirst=async q=>{const value=await original(q);return q.where.status==='CLOSED'?{...value,customer:{active:changed!=='inactive'},pets:[{pet:{active:true,customerId:changed==='owner'?'other':'customer'}}]}:value};assert.equal(await f.plan(),null)}});

test('one transferred dog in a multi-dog visit invalidates the earlier invitation text',async()=>{const f=fixture();f.ticket.pets=[{pet:{id:'one',active:true,customerId:'customer'}},{pet:{id:'two',active:true,customerId:'customer'}}];const original=f.client.ticket.findFirst;f.client.ticket.findFirst=async q=>{const value=await original(q);return q.where.status==='CLOSED'?{...value,pets:[value.pets[0],{pet:{...value.pets[1].pet,customerId:'new-family'}}]}:value};assert.equal(await f.plan(),null)});
test('activation date, delay, location and VIP conditions use the current record',async()=>{const f=fixture();f.rule.existingRecords='NEW_ONLY';f.rule.activatedAt='2030-02-13';assert.equal(await f.plan(),null);f.rule.activatedAt='2030-02-12T07:00Z';assert.equal(await f.plan(),null);f.rule.existingRecords='INCLUDE';f.rule.delayMinutes=1440;assert.equal((await f.plan()).ready,false);f.rule.locationIds=['other'];assert.equal(await f.plan(),null);f.rule.locationIds=[];f.rule.conditions.vip='ACTIVE';assert.equal(await f.plan(),null);f.vip(true);assert.ok(await f.plan())});
test('custom rebooking replaces only the rebooking message and preserves the stable completed-visit date',async()=>{const f=fixture();f.rule.activatedAt='2020-01-01';f.ticket.closedAt=new Date(Date.now()-60*86400000);const p=await ticketCustomRule(f.client,f.ticket,'REBOOKING');assert.equal(p.action.kind,'MESSAGE');assert.equal(p.eventId,'customer-overdue:t');const plans=await customLifecyclePlans(f.client,f.ticket,{reportCardMode:'ASK'});assert.deepEqual(plans.map(p=>p.kind),['REBOOKING']);assert.equal(+plans[0].at,+f.ticket.closedAt)});

test('overdue staff task is created once and a booking arriving before creation suppresses it',async()=>{
 const {runOverdueCustomerRules}=require('../src/lib/custom-rule-retention.ts');
 for(const bookBeforeWrite of [false,true]){
  const f=fixture(),saved=new Map(),audits=[];f.rule.activatedAt='2020-01-01';f.rule.updatedBy='manager';f.rule.actions=[{...f.rule.actions[0],kind:'TASK',channels:[],assigneeIds:['csr']}];f.ticket.closedAt=new Date(Date.now()-60*86400000);Object.assign(f.ticket.customer,{id:'customer',firstName:'Maria',balanceCents:0});
  saved.set('CUSTOM_RULE:'+f.rule.id,{value:f.rule});const original=f.client.ticket.findFirst;f.client.ticket.findFirst=async q=>q.where.id?f.ticket:original(q);
  f.client.$queryRaw=async strings=>strings.join('').includes('SELECT t.id')?[{id:'t'}]:[];
  f.client.customer={findFirst:async()=>f.ticket.customer};f.client.user={findMany:async()=>[{id:'csr'}]};f.client.auditEntry={create:async q=>audits.push(q.data)};
  f.client.tenantSetting.findUnique=async q=>saved.get(q.where.tenantId_settingKey.settingKey)||null;
  f.client.tenantSetting.create=async q=>saved.set(q.data.settingKey,{value:q.data.value});
  f.client.tenantSetting.upsert=async q=>{throw Error(q.create.value.message)};
  f.client.$transaction=async fn=>{if(bookBeforeWrite)f.future({source:'PHONE'});return fn(f.client)};
  await runOverdueCustomerRules(f.client,{id:'tenant',name:'Shop'},[f.rule]);await runOverdueCustomerRules(f.client,{id:'tenant',name:'Shop'},[f.rule]);
  assert.equal(audits.length,bookBeforeWrite?0:1);if(!bookBeforeWrite)assert.equal(audits[0].action,'CUSTOM_RULE_TASK');
 }
});
