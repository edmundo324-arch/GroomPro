const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
require('./load-ts.cjs');
const {NextRequest}=require('next/server');
const context=require('../src/lib/customer-sharing-context.ts');
const query=require('../src/lib/customer-sharing-query.ts');
function setup(enabled=true){
 const config={enabled,revision:1,groups:[{id:'one',name:'One',locationIds:['a','b']},{id:'two',name:'Two',locationIds:['z']}]};
 const db={tenantSetting:{findUnique:async()=>({value:config})},customer:{findFirst:async({where})=>where.id==='allowed'?{id:'allowed'}:null},pet:{findFirst:async()=>null},ticket:{findFirst:async()=>null}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/customer-sharing-request.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,process,URL,Error,require:name=>({'next/server':require('next/server'),'./db':{db},'./customer-sharing-context':context,'./customer-sharing-query':query}[name])});
 return exports.withCustomerSharing;
}
const employee={user:{id:'u',role:'FRONT',locationId:'a'}};
function request(path,body){return new NextRequest('http://localhost'+path,{headers:{'x-tenant-id':'tenant','Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})})}
test('request applies assigned shop and preserves the handler request body',async()=>{
 const run=setup();let calls=0;
 const response=await run(request('/api/pos-operation',{customerId:'allowed',kind:'SAVE'}),employee,async r=>{calls++;assert.equal(r.nextUrl.searchParams.get('locationId'),'a');assert.equal((await r.json()).kind,'SAVE');assert.deepEqual(context.sharingScope.getStore().locations,['a','b']);return 'ok'});
 assert.equal(response,'ok');assert.equal(calls,1);assert.equal(context.sharingScope.getStore(),undefined);
});
test('staff cannot select another shop or open an unshared customer',async()=>{
 const run=setup(),never=async()=>assert.fail('handler must not run');
 assert.equal((await run(request('/api/customers?id=private'),employee,never)).status,403);
 assert.equal((await run(request('/api/customers?locationId=z'),employee,never)).status,403);
 assert.equal((await run(request('/api/pos-operation',{customerId:'private'}),employee,never)).status,403);
 assert.equal((await run(request('/api/customers'),null,never)).status,401);
});
test('manager location choice stays scoped; platform access and disabled groups preserve existing behavior',async()=>{
 const run=setup();await run(request('/api/customers?locationId=z'),{user:{role:'MANAGER',locationId:'a'}},async()=>assert.equal(context.sharingScope.getStore().locationId,'z'));
 await run(request('/api/customers'),{user:{role:'PLATFORM_OWNER'}},async()=>assert.equal(context.sharingScope.getStore(),undefined));
 assert.equal(await setup(false)(request('/api/customers'),null,async()=> 'unchanged'),'unchanged');
});
test('old per-customer permissions cannot override grouped sharing',async()=>{
 assert.equal((await setup()(request('/api/customers/location-access',{customerId:'allowed'}),employee,async()=>assert.fail())).status,409);
});
