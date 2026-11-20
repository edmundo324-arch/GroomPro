const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function fixture(file,role='MANAGER'){
 const calls=[],policies=[];let session=role?{tenantId:'signed-tenant',user:{id:'signed-user',role}}:null;
 const fn=name=>async(...args)=>{calls.push({name,args});return {ok:true}};
 const store=Object.fromEntries(['readPromotions','savePromotions','applyPromotions','onlineClassCatalog','changeOnlineCatalog','readOnlineClasses','saveOnlineClasses'].map(n=>[n,fn(n)]));
 const deps={'next/server':{NextResponse:{json:(body,init={})=>({body,status:init.status||200,headers:init.headers})}},'@/src/lib/platform-access':{platformSession:async()=>session},'@/src/lib/request-policy':{withRequestPolicy:(f,p)=>{policies.push(p);return f}},'@/src/lib/promotion-store':store,'@/src/lib/online-booking-classes':store};
 const api={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(k=>{assert.ok(deps[k],k);return deps[k]},api);
 return {api,calls,policies,request:(method,body={})=>({method,nextUrl:new URL('https://test.invalid/api'),json:async()=>body})};
}
test('promotion configuration requires manager identity; application uses signed tenant and employee',async()=>{
 const path='app/api/promotions/route.ts',none=fixture(path,null),staff=fixture(path,'EMPLOYEE'),manager=fixture(path);
 assert.equal((await none.api.GET(none.request('GET'))).status,401);
 assert.equal((await staff.api.PUT(staff.request('PUT'))).status,403);assert.equal(staff.calls.length,0);
 await staff.api.POST(staff.request('POST',{tenantId:'other',userId:'other',ticketId:'ticket',code:'SAVE'}));
 assert.deepEqual(staff.calls[0],{name:'applyPromotions',args:['signed-tenant','signed-user','ticket','SAVE',undefined]});
 await manager.api.PUT(manager.request('PUT',{tenantId:'other',rules:[]}));assert.deepEqual(manager.calls[0].args.slice(0,2),['signed-tenant','signed-user']);
 assert.deepEqual(manager.policies,[{configure:true},{configure:true},{}]);
});
test('booking class catalog and writes require manager access and retain signed tenant scope',async()=>{
 const path='app/api/online-booking-classes/route.ts';
 for(const role of [null,'EMPLOYEE']){const f=fixture(path,role);for(const method of ['GET','PUT','POST'])assert.equal((await f.api[method](f.request(method))).status,role?403:401);assert.equal(f.calls.length,0)}
 const f=fixture(path);await f.api.POST(f.request('POST',{tenantId:'other',action:'ENABLE_CLASS',classId:'class-0'}));assert.deepEqual(f.calls[0].args.slice(0,2),['signed-tenant','signed-user']);assert.ok(f.policies.every(p=>p.configure));
});
