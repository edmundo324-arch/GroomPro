const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');require('./load-ts.cjs');
function fixture(){
 let ticket={id:'ticket',tenantId:'tenant',locationId:'shop',status:'CLOSED',tipCents:0,totalCents:10000},setting=null,payments=[],audits=[],receipts=new Map();
 const tx={$queryRaw:async()=>[],ticket:{findFirst:async({where})=>where.id===ticket.id&&where.tenantId===ticket.tenantId&&where.locationId===ticket.locationId?{...ticket}:null,update:async({data})=>Object.assign(ticket,data)},tenantSetting:{findUnique:async()=>setting,upsert:async({create,update})=>setting={value:setting?update.value:create.value}},payment:{create:async({data})=>{payments.push(data);return data}},auditEntry:{create:async({data})=>audits.push(data)},posOperation:{findUnique:async({where})=>receipts.get(where.tenantId_requestKey.requestKey),create:async({data})=>receipts.set(data.requestKey,data)}};
 const db={...tx,user:{findMany:async()=>[{id:'g'},{id:'b'},{id:'p'}]},$transaction:async fn=>{const before=structuredClone({ticket,setting,payments,audits,receipts});try{return await fn(tx)}catch(e){({ticket,setting,payments,audits,receipts}=before);throw e}}};
 const dependencies={'node:crypto':require('node:crypto'),'next/server':{NextResponse:{json:Response.json}},'@/src/lib/db':{db},'@/src/lib/request-policy':{withRequestPolicy:f=>f,hidePlatformOwners:async()=>true},'@/src/lib/employee-session':{getActiveEmployeeSession:async()=>({user:{id:'actor'}})},'@/src/lib/request-location':{requestLocation:async()=> 'shop'},'@/src/lib/ticket-tips':require('../src/lib/ticket-tips.ts')};
 const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../app/api/tickets/tips/route.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(k=>dependencies[k],exports);
 const body={ticketId:'ticket',action:'ADD',requestId:'11111111-1111-1111-1111-111111111111',revision:0,expectedTipCents:0,amountCents:3000,paymentType:'CASH',shares:[{userId:'g',amountCents:1500},{userId:'b',amountCents:1000},{userId:'p',amountCents:500}]};
 return {body,post:b=>exports.POST({headers:new Headers({'x-tenant-id':'tenant'}),cookies:{get:()=>({value:'session'})},json:async()=>b}),state:()=>({ticket,setting,payments,audits,receipts})};
}
test('post-checkout tip records payment and shares atomically, with retry protection',async()=>{
 const f=fixture(),first=await f.post(f.body);assert.equal(first.status,200);assert.equal(f.state().ticket.tipCents,3000);assert.equal(f.state().ticket.totalCents,13000);assert.equal(f.state().ticket.status,'CLOSED');assert.equal(f.state().payments.length,1);assert.equal(f.state().setting.value.shares[0].amountCents,1500);
 assert.equal((await f.post(f.body)).status,200);assert.equal(f.state().payments.length,1);assert.equal(f.state().audits.length,1);
 assert.equal((await f.post({...f.body,amountCents:4000})).status,400);assert.equal(f.state().payments.length,1);
});
test('tip rejects stale amounts, mismatched allocations and another business ticket without charging',async()=>{
 for(const patch of [{expectedTipCents:1},{revision:4},{ticketId:'other'},{shares:[{userId:'g',amountCents:1000}]},{paymentType:'UNSUPPORTED'}]){const f=fixture();assert.equal((await f.post({...f.body,...patch})).status,400);assert.equal(f.state().payments.length,0);assert.equal(f.state().ticket.totalCents,10000);assert.equal(f.state().setting,null);}
});
test('reallocating saved tips never creates another payment',async()=>{
 const f=fixture();await f.post(f.body);const r=await f.post({...f.body,action:'ALLOCATE',requestId:'22222222-2222-2222-2222-222222222222',revision:1,expectedTipCents:3000,shares:[{userId:'g',amountCents:1000},{userId:'b',amountCents:1000},{userId:'p',amountCents:1000}]});assert.equal(r.status,200);assert.equal(f.state().payments.length,1);assert.equal(f.state().setting.value.shares[0].amountCents,1000);
});
