require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {Prisma}=require('@prisma/client'),syncRules=require('../src/lib/catalog-sync.ts');
function load(file,deps){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{assert.ok(name in deps,'Unexpected import '+name);return deps[name]},exports);return exports;}
const sql=(query,values)=>({text:Array.isArray(query)?query.join('?'):query.sql,values:Array.isArray(query)?values:query.values});

function bulkFixture(){
 const events=[],syncCalls=[],records=[{id:'s1',priceCents:1000},{id:'s2',priceCents:2000}];
 const tx={
  $queryRaw:async(query,...values)=>{const q=sql(query,values);events.push(q);assert.ok(q.values.includes('tenant'));return /FROM Service/.test(q.text)?records:[]},
  $executeRaw:async query=>{events.push(sql(query,[]));return 1},
  ticket:{findMany:async query=>{assert.equal(query.where.tenantId,'tenant');assert.equal(query.where.closedAt,null);return [{id:'t1'},{id:'t2'}]}}
 };
 const client={$transaction:async(fn,options)=>{assert.equal(options.timeout,120000);assert.equal(options.isolationLevel,'ReadCommitted');return fn(tx)}};
 const module=load('src/lib/pricing.ts',{
  crypto:require('crypto'),'@prisma/client':{Prisma},'@/src/lib/db':{db:client},'./catalog-sync':syncRules,
  './catalog-sync-store':{
   catalogRecord:async(client,tenant,kind,id)=>{assert.equal(client,tx);assert.equal(tenant,'tenant');assert.equal(kind,'services');return {...records.find(r=>r.id===id),name:id}},
   syncCatalogAppointments:async(client,tenant,actor,change,scope)=>{assert.equal(client,tx);assert.equal(tenant,'tenant');assert.equal(actor,'manager');syncCalls.push({change,scope});return {updated:1,unchanged:1,ticketIds:['t1'],review:[{ticketId:'t2',orderNumber:22,reason:change.before.id+' custom price kept.'}]}}
  }
 });
 return {run:change=>module.bulkIncreaseBasePrices('tenant',{entityType:'SERVICE',adjustmentPct:10,actorUserId:'manager',...change}),events,syncCalls};
}

test('bulk default updates catalog and pricing history without appointment propagation',async()=>{
 const f=bulkFixture(),result=await f.run({});assert.equal(result.changedCount,2);assert.equal(f.syncCalls.length,0);assert.deepEqual(result.sync,syncRules.emptyCatalogSync());
 assert.match(f.events[0].text,/Tenant.*FOR UPDATE/);assert.equal(f.events.filter(q=>/INSERT INTO PricingChangeBatch/.test(q.text)).length,1);assert.equal(f.events.filter(q=>/INSERT INTO PricingChangeItem/.test(q.text)).length,2);
});
test('bulk propagates selected scope with before/after prices and unique appointment results',async()=>{
 const f=bulkFixture(),result=await f.run({applyTo:'FUTURE'});
 assert.equal(f.syncCalls.length,2);assert.deepEqual(f.syncCalls.map(c=>[c.scope,c.change.before.priceCents,c.change.after.priceCents]),[['FUTURE',1000,1100],['FUTURE',2000,2200]]);
 assert.equal(result.sync.updated,1);assert.equal(result.sync.unchanged,1);assert.deepEqual(result.sync.ticketIds,['t1']);assert.equal(result.sync.review.length,1);assert.match(result.sync.review[0].reason,/s1.*s2/);
});
test('invalid sync scope is rejected before a bulk transaction starts',async()=>{const f=bulkFixture();await assert.rejects(f.run({applyTo:'CLOSED'}),/Choose where/);assert.equal(f.events.length,0)});

function locationFixture({validLocation=true,role='MANAGER'}={}){
 const calls=[],record={id:'s1',name:'Bath',active:true,priceCents:1000};
 const old=[{locationId:'shop',priceAdjustmentPct:10,priceOverrideCents:null,active:true}];
 const tx={
  $queryRaw:async(query,...values)=>{const q=sql(query,values);calls.push(q);assert.ok(q.values.includes('tenant'));if(/FROM Location WHERE/.test(q.text))return validLocation?[{id:'shop'}]:[];if(/FROM LocationServicePricing/.test(q.text))return old;return []},
  $executeRaw:async query=>{calls.push(sql(query,[]));return 1}
 };
 const client={$transaction:async(fn,options)=>{assert.equal(options.timeout,120000);assert.equal(options.isolationLevel,'ReadCommitted');return fn(tx)}};
 const syncCalls=[];
 const module=load('app/api/location-pricing/route.ts',{
  '@/src/lib/catalog-sync':syncRules,
  '@/src/lib/catalog-sync-store':{
   catalogRecord:async(c,tenant,kind,id)=>{assert.equal(c,tx);assert.equal(tenant,'tenant');assert.equal(kind,'services');assert.equal(id,'s1');return record},
   syncCatalogAppointments:async(c,tenant,actor,change,scope)=>{assert.equal(c,tx);assert.equal(tenant,'tenant');assert.equal(actor,'manager');syncCalls.push({change,scope});return syncRules.emptyCatalogSync()}
  },
  '@/src/lib/request-policy':{withRequestPolicy:handler=>handler},'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}},'@prisma/client':{Prisma},'@/src/lib/db':{db:client},'@/src/lib/employee-session':{getActiveEmployeeSession:async()=>({user:{id:'manager',role}})}
 });
 return {calls,syncCalls,record,run:body=>module.PUT({headers:new Headers({'x-tenant-id':'tenant'}),cookies:{get:()=>({value:'session'})},json:async()=>({locationId:'shop',entityId:'s1',entityType:'SERVICE',mode:'FIXED',priceOverrideCents:2500,...body})})};
}
test('location override and appointment sync share lock/transaction and exact old/new location rules',async()=>{
 const f=locationFixture(),response=await f.run({applyTo:'FUTURE'});assert.equal(response.status,200);assert.match(f.calls[0].text,/Tenant.*FOR UPDATE/);assert.equal(f.syncCalls.length,1);
 const {change,scope}=f.syncCalls[0];assert.equal(scope,'FUTURE');assert.equal(change.locationId,'shop');assert.equal(change.before,f.record);assert.equal(change.after,f.record);assert.equal(change.beforeLocationPricing[0].priceAdjustmentPct,10);assert.equal(change.locationPricing[0].priceOverrideCents,2500);assert.equal(change.locationPricing[0].priceAdjustmentPct,0);
});
test('location default is NONE and foreign locations/managers remain protected',async()=>{
 const ordinary=locationFixture();assert.equal((await ordinary.run({})).status,200);assert.equal(ordinary.syncCalls[0].scope,'NONE');
 const missing=locationFixture({validLocation:false});assert.equal((await missing.run({applyTo:'ALL'})).status,404);assert.equal(missing.syncCalls.length,0);assert.ok(!missing.calls.some(q=>/INSERT/.test(q.text)));
 const denied=locationFixture({role:'FRONT'});assert.equal((await denied.run({applyTo:'ALL'})).status,403);assert.equal(denied.calls.length,0);
});
