const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function fixture(){
 let row;const calls=[];const db={customer:{findFirst:async({where})=>where.tenantId==='tenant'&&where.id==='customer'?{id:'customer',email:'customer@example.test'}:null},tenant:{findUniqueOrThrow:async()=>({name:'Test Grooming'})},communication:{create:async({data})=>(row={id:'message',...data}),update:async({data})=>(row={...row,...data}),updateMany:async({where,data})=>{if(row.deliveryStatus===where.deliveryStatus)row={...row,...data}},findUniqueOrThrow:async()=>row}};
 const env={GROOMPRO_AGREEMENT_EMAIL_TENANTS_JSON:JSON.stringify({tenant:{apiKey:'secret',from:'shop@example.test'}})};let response={ok:true,status:200,json:async()=>({id:'receipt'})};
 const api={};new Function('require','exports','process','fetch',ts.transpileModule(fs.readFileSync('src/lib/customer-email.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(()=>({db}),api,{env},async(...args)=>{calls.push(args);if(response instanceof Error)throw response;return response});
 return {api,env,calls,setResponse:r=>response=r,send:()=>api.sendCustomerEmail({tenantId:'tenant',customerId:'customer',body:'Hello'})};
}
test('email sends only for the tenant/customer and records acceptance rather than delivery',async()=>{
 const f=fixture();await assert.rejects(f.api.sendCustomerEmail({tenantId:'other',customerId:'customer',body:'Hello'}));assert.equal(f.calls.length,0);
 const r=await f.send();assert.equal(r.communication.deliveryStatus,'ACCEPTED');assert.equal(r.communication.externalId,'receipt');assert.equal(r.communication.sentAt,undefined);
 assert.deepEqual(JSON.parse(f.calls[0][1].body),{from:'shop@example.test',to:['customer@example.test'],subject:'A message from Test Grooming',text:'Hello'});assert.equal(f.calls[0][1].headers['Idempotency-Key'],'communication-message');
});
test('unconfigured email stays saved without contacting provider',async()=>{const f=fixture();f.env.GROOMPRO_AGREEMENT_EMAIL_TENANTS_JSON='{}';assert.equal((await f.send()).communication.deliveryStatus,'NOT_CONFIGURED');assert.equal(f.calls.length,0)});
test('explicit rejection is failed; network/server/invalid receipts stay uncertain without retry',async()=>{
 const f=fixture();f.setResponse({ok:false,status:400});assert.equal((await f.send()).communication.deliveryStatus,'FAILED');
 for(const response of [Error('timeout'),{ok:false,status:503},{ok:true,status:200,json:async()=>({})}]){const g=fixture();g.setResponse(response);assert.equal((await g.send()).communication.deliveryStatus,'UNKNOWN');assert.equal(g.calls.length,1)}
});
