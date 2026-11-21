const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require('./load-ts.cjs');
const policy=require('../src/lib/cancellation-policy.ts');
function fixture(){
 let state={ticket:{id:'t',tenantId:'business',customerId:'customer',status:'CONFIRMED',scheduledStart:new Date(Date.now()+3600000),checkedInAt:null,orderNumber:8,tenant:{name:'Test Shop'},location:{timezone:'America/Chicago'}},rows:{},audits:[],fees:0};let chain=Promise.resolve();
 const db={$transaction:fn=>{const run=chain.then(async()=>{const before=structuredClone(state);try{return await fn(tx)}catch(e){state=before;throw e}});chain=run.catch(()=>{});return run;}};
 const tx={$queryRaw:async()=>[],ticket:{findFirst:async({where})=>state.ticket.tenantId===where.tenantId&&state.ticket.id===where.id&&(!where.customerId||where.customerId===state.ticket.customerId)?structuredClone(state.ticket):null,update:async({data})=>Object.assign(state.ticket,data)},tenantSetting:{findUnique:async({where})=>{const key=where.tenantId_settingKey.settingKey;return key==='NO_SHOW_FEE_CENTS'?{value:4500}:state.rows[key]||null},create:async({data})=>state.rows[data.settingKey]={value:structuredClone(data.value)},update:async({where,data})=>state.rows[where.tenantId_settingKey.settingKey]={value:structuredClone(data.value)}},auditEntry:{create:async({data})=>state.audits.push(data)}};
 const dependencies={'node:crypto':require('node:crypto'),'./db':{db},'./portal-policy-store':{readPortalPolicy:async()=>policy.defaultPortalPolicy},'./cancellation-policy':policy,'./account-fee':{assessAccountFee:async(tx,p)=>{state.fees+=p.feeCents;return{creditUsedCents:0,owedCents:p.feeCents}}}};
 const js=ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../src/lib/portal-requests.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};
 new Function('require','exports',js)(name=>{if(!(name in dependencies))throw Error(name);return dependencies[name]},exports);
 return {api:exports,state:()=>state,warning:policy.cancellationWarning(policy.defaultPortalPolicy,'Test Shop',4500)};
}
test('late requests keep the booking, timestamp and quote; retries do not duplicate them',async()=>{
 const f=fixture();const a=await f.api.requestCancellation('business','customer','t','Please waive',true,4500,f.warning);
 const b=await f.api.requestCancellation('business','customer','t','Retry',true,4500,f.warning);
 assert.equal(a.state,'PENDING');assert.deepEqual(a,b);assert.equal(f.state().ticket.status,'CONFIRMED');assert.equal(f.state().fees,0);assert.equal(f.state().audits.length,1);
});
test('wrong owner and unacknowledged/changed quotes make no changes',async()=>{
 const f=fixture();await assert.rejects(()=>f.api.requestCancellation('business','other','t','',true,4500,f.warning));
 await assert.rejects(()=>f.api.requestCancellation('business','customer','t','',false,4500,f.warning));
 await assert.rejects(()=>f.api.requestCancellation('business','customer','t','',true,1000,f.warning));
 assert.deepEqual(f.state().rows,{});assert.equal(f.state().ticket.status,'CONFIRMED');
});
test('on-time cancellation needs no fee and cancels the existing ticket',async()=>{
 const f=fixture();f.state().ticket.scheduledStart=new Date(Date.now()+72*3600000);
 const r=await f.api.requestCancellation('business','customer','t','',false);
 assert.equal(r.state,'ON_TIME');assert.equal(r.feeCents,0);assert.equal(f.state().ticket.status,'CANCELLED');
});
test('concurrent reviews apply one fee; waivers apply none',async()=>{
 for(const waive of [true,false]){const f=fixture();await f.api.requestCancellation('business','customer','t','',true,4500,f.warning);
 await Promise.all([f.api.reviewCancellation('business','t','manager',waive,'Reviewed'),f.api.reviewCancellation('business','t','manager',waive,'Retry')]);
 assert.equal(f.state().fees,waive?0:4500);assert.equal(f.state().ticket.status,'CANCELLED');assert.equal(f.state().audits.length,2);}
});
test('a moved appointment cannot have the old request silently applied',async()=>{
 const f=fixture();await f.api.requestCancellation('business','customer','t','',true,4500,f.warning);f.state().ticket.scheduledStart=new Date(Date.now()+96*3600000);
 await assert.rejects(()=>f.api.reviewCancellation('business','t','manager',false,'Reviewed'),/changed/);assert.equal(f.state().fees,0);
});

test('same shop-day moves keep the booking without charging, including across UTC midnight',async()=>{
 const f=fixture();f.state().ticket.scheduledStart=new Date('2030-01-02T23:00:00Z');
 f.state().rows['PORTAL_CANCELLATION:t']={value:{id:'request',state:'PENDING',scheduledStart:'2030-01-02T23:00:00Z',late:true,feeCents:4500}};
 f.state().ticket.scheduledStart=new Date('2030-01-03T01:00:00Z');
 const result=await f.api.reviewCancellation('business','t','manager',false,'Same-day move',{keepAppointment:true,expectedStart:'2030-01-03T01:00:00.000Z'});
 assert.equal(result.state,'KEPT');assert.equal(result.feeAppliedCents,0);assert.equal(f.state().ticket.status,'CONFIRMED');assert.equal(f.state().fees,0);
});
test('different-day late moves apply one fee or an explicit waiver and never cancel the moved booking',async()=>{
 for(const waive of [false,true]){const f=fixture();await f.api.requestCancellation('business','customer','t','',true,4500,f.warning);f.state().ticket.scheduledStart=new Date(Date.now()+96*3600000);const options={keepAppointment:true,expectedStart:f.state().ticket.scheduledStart.toISOString()};
 const result=await f.api.reviewCancellation('business','t','manager',waive,'Moved to another date',options);await f.api.reviewCancellation('business','t','manager',waive,'Retry',options);
 assert.equal(result.keptAppointment,true);assert.equal(f.state().ticket.status,'CONFIRMED');assert.equal(f.state().fees,waive?0:4500);assert.equal(f.state().audits.length,2);}
});
test('a second move after the review screen opened cannot apply an outdated decision',async()=>{
 const f=fixture();await f.api.requestCancellation('business','customer','t','',true,4500,f.warning);f.state().ticket.scheduledStart=new Date(Date.now()+96*3600000);
 await assert.rejects(()=>f.api.reviewCancellation('business','t','manager',false,'Moved',{keepAppointment:true,expectedStart:'2000-01-01T00:00:00Z'}),/changed/);assert.equal(f.state().fees,0);
});

test('a kept appointment can receive a fresh cancellation request without replaying an older request',async()=>{
 const f=fixture();const first=await f.api.requestCancellation('business','customer','t','',true,4500,f.warning);f.state().ticket.scheduledStart=new Date(Date.now()+96*3600000);
 await f.api.reviewCancellation('business','t','manager',true,'Moved',{keepAppointment:true,expectedStart:f.state().ticket.scheduledStart.toISOString()});
 const stale=await f.api.requestCancellation('business','customer','t','Retry',true,4500,f.warning);assert.equal(stale.keptAppointment,true);
 const fresh=await f.api.requestCancellation('business','customer','t','Cancel the new date',false,4500,f.warning,first.id);assert.equal(fresh.state,'ON_TIME');assert.notEqual(fresh.id,first.id);assert.equal(f.state().ticket.status,'CANCELLED');
});

test('an in-flight no-show charge prevents a second cancellation fee',async()=>{const f=fixture();await f.api.requestCancellation('business','customer','t','',true,4500,f.warning);f.state().rows['NO_SHOW_OPERATION:t']={value:{state:'RUNNING'}};await assert.rejects(f.api.reviewCancellation('business','t','manager',false,'Apply fee'),/processing or needs verification/);assert.equal(f.state().fees,0);assert.equal(f.state().rows['PORTAL_CANCELLATION:t'].value.state,'PENDING');});
