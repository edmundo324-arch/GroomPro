require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {catalogVersion}=require('../src/lib/catalog-version.ts');
const sync=require('../src/lib/catalog-sync.ts');
function fixture({role='MANAGER',signedIn=true,failSync=false}={}){
 let row={id:'service',tenantId:'business',name:'Bath',description:'A gentle bath.',priceCents:5000,durationMin:30,active:true,category:'Bath',workflowRole:'BATH'};
 let plan={name:'Bath VIP',description:'Member bath.',priceCents:4000,active:true,items:[{serviceId:'service',quantity:1,role:'BATH'}],billingDay:1,billingDaySecond:null};
 const calls=[],audits=[];
 const tx={
  $queryRaw:async(query,...values)=>{assert.match(query.join('?'),/Tenant.*FOR UPDATE/);assert.ok(values.includes('business'));calls.push('lock');return [{id:'business'}]},
  service:{findFirst:async()=>({...row}),findMany:async()=>[{id:'service',workflowRole:'BATH'}],count:async()=>1,update:async({data})=>{calls.push('write');row={...row,...data};return row}},
  tenantSetting:{findUnique:async({where})=>where.tenantId_settingKey.settingKey==='VIP_PLAN:vip'?{value:structuredClone(plan)}:null,upsert:async({update})=>{plan=update.value;return {value:plan}}},
  auditEntry:{create:async({data})=>{audits.push(data);return data}},
 };
 const db={$transaction:async(fn,options)=>{assert.equal(options.timeout,120000);assert.equal(options.isolationLevel,'ReadCommitted','Locked appointment reads must see changes committed while waiting');const prior=structuredClone({row,plan,audits});try{return await fn(tx)}catch(error){row=prior.row;plan=prior.plan;audits.splice(0,audits.length,...prior.audits);throw error}}};
 const deps={
  '@/src/lib/stock-history':{},'@/src/lib/offline-transaction':{offlineCreateId:()=>undefined},'@/src/lib/catalog-version':{catalogVersion},
  '@/src/lib/catalog-sync':sync,
  '@/src/lib/catalog-sync-store':{
   catalogRecord:async(client,tenant,kind,id)=>{assert.equal(client,tx);assert.equal(tenant,'business');return kind==='plans'?structuredClone(plan):{...row}},
   retainLegacyServiceSnapshots:async(client,tenant,before,after)=>{assert.equal(client,tx);assert.equal(tenant,'business');calls.push('snapshots')},
   syncCatalogAppointments:async(client,tenant,actor,change,scope)=>{assert.equal(client,tx);assert.equal(tenant,'business');assert.equal(actor,'manager');calls.push({scope,change});if(failSync)throw Error('Storage unavailable');return {updated:1,unchanged:0,ticketIds:['ticket'],review:[]}},
  },
  '@/src/lib/vip-plan-sync':{vipSyncChoices:require('../src/lib/vip-plan-sync.ts').vipSyncChoices,syncVipPlanMembers:async(client,tenant,actor,id,before,after,choices)=>{assert.equal(client,tx);calls.push({vip:choices,before,after});return {vipBenefitsUpdated:choices.updateVipBenefits?1:0,vipPricesUpdated:choices.updateVipPrice?1:0}}},
  '@/src/lib/service-promotion':require('../src/lib/service-promotion.ts'),
  '@/src/lib/request-policy':{withRequestPolicy:handler=>handler,catalogFeature:()=>true},'@/src/lib/breed-store':{loadBreeds:async()=>[]},
  'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}},'node:crypto':require('node:crypto'),'@/src/lib/db':{db},
  '@/src/lib/employee-session':{getActiveEmployeeSession:async()=>signedIn?{user:{id:'manager',role}}:null},
  '@/src/lib/catalog-input':require('../src/lib/catalog-input.ts'),
 };
 const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync('app/api/catalog/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{assert.ok(name in deps,'Unexpected import '+name);return deps[name]},exports);
 return {calls,audits,row:()=>row,plan:()=>plan,run:async(body={})=>exports.PATCH({method:'PATCH',headers:new Headers({'x-tenant-id':'business'}),cookies:{get:()=>({value:'session'})},json:async()=>({kind:'services',id:'service',name:'Bath',description:'A gentle bath.',priceCents:6000,durationMin:30,active:true,category:'Bath',...body})})};
}
test('catalog defaults to new bookings and retains missing historical snapshots before save',async()=>{
 const f=fixture(),response=await f.run();assert.equal(response.status,200);assert.equal(f.row().priceCents,6000);assert.deepEqual(f.calls,['lock','snapshots','write']);assert.equal((await response.json()).sync.updated,0);assert.equal(f.audits[0].details.applyTo,'NONE');
});
test('appointment propagation requires current catalog revision and shares the catalog transaction',async()=>{
 const f=fixture(),version=catalogVersion(f.row());assert.equal((await f.run({applyTo:'FUTURE',catalogVersion:version})).status,200);
 const call=f.calls.find(c=>c.scope);assert.equal(call.scope,'FUTURE');assert.equal(call.change.before.priceCents,5000);assert.equal(call.change.after.priceCents,6000);
 const stale=await f.run({applyTo:'ALL',catalogVersion:version,priceCents:7000});assert.equal(stale.status,400);assert.match((await stale.json()).error,/changed while you were editing/);assert.equal(f.row().priceCents,6000);
});
test('storage failure rolls back catalog and audit instead of reporting a partial success',async()=>{
 const f=fixture({failSync:true}),response=await f.run({applyTo:'ALL',catalogVersion:catalogVersion(f.row())});assert.equal(response.status,400);assert.equal(f.row().priceCents,5000);assert.equal(f.audits.length,0);
});
test('employee access and invalid propagation choices fail before database writes',async()=>{
 for(const options of [{role:'FRONT'},{signedIn:false}]){const f=fixture(options),response=await f.run({applyTo:'ALL'});assert.ok([401,403].includes(response.status));assert.deepEqual(f.calls,[])}
 const f=fixture();assert.equal((await f.run({applyTo:'TODAY'})).status,400);assert.equal((await f.run({updateVipPrice:true})).status,400);assert.deepEqual(f.calls,[]);
});
test('VIP catalog request independently passes benefits and price choices with stale edit protection',async()=>{
 for(const choices of [{updateVipBenefits:true,updateVipPrice:false},{updateVipBenefits:false,updateVipPrice:true},{updateVipBenefits:true,updateVipPrice:true}]){
  const f=fixture(),response=await f.run({kind:'plans',id:'vip',name:'Bath VIP',priceCents:4500,items:[{serviceId:'service',quantity:2,role:'BATH'}],billingDay:1,catalogVersion:catalogVersion(f.plan()),...choices});assert.equal(response.status,200);assert.deepEqual(f.calls.find(c=>c.vip).vip,choices);assert.equal(f.calls.filter(c=>c.scope).length,0);
 }
 const f=fixture();assert.equal((await f.run({kind:'plans',id:'vip',name:'Bath VIP',priceCents:4500,items:[{serviceId:'service',quantity:1}],billingDay:1,updateVipBenefits:true,catalogVersion:'old'})).status,400);assert.equal(f.calls.filter(c=>c.vip).length,0);
});
test('bulk appointment propagation is not replayed offline; new-booking-only edits remain available',()=>{
 const {offlineAction}=require('../src/lib/offline-actions.ts'),url=new URL('https://local/api/catalog');
 for(const kind of ['services','packages'])for(const applyTo of ['ALL','FUTURE'])assert.equal(offlineAction(url,'PATCH',{id:'item',kind,applyTo}),null);
 assert.deepEqual(offlineAction(url,'PATCH',{id:'item',kind:'services',applyTo:'NONE'}),{target:{entity:'service',id:'item'}});
});
test('report cards preserve empty and populated saved wording instead of adopting later catalog edits',()=>{
 const {reportCardText}=require('../src/lib/report-card.ts'),ticket={pets:[{pet:{id:'dog',name:'Gizmo'}}],lines:[{petId:'dog',lineType:'SERVICE',reportCardDescription:'',service:{description:'New service description'}}]};
 assert.doesNotMatch(reportCardText(ticket),/New service/);ticket.lines[0].reportCardDescription='Original visit description';assert.match(reportCardText(ticket),/Original visit/);
 ticket.lines[0].reportCardDescription=null;assert.match(reportCardText(ticket),/New service/);
});
