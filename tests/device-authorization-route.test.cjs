const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require('./load-ts.cjs');
const roles=require('../src/lib/roles.ts'),context=require('../src/lib/business-context.ts');
function fixture(){
 let session=null,approved=false;const calls=[],db={};
 const dependencies={'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200,headers:options?.headers})}},'@/src/lib/db':{db},'@/src/lib/platform-business':{currentBusinessSession:async(...args)=>{calls.push(args);return session}},'@/src/lib/roles':roles,'@/src/lib/employee-session':{},'@/src/lib/business-context':context,'@/src/lib/device-authorization':{deviceApprovalCookie:'proof',deviceApproved:async()=>approved,approveDevice:()=>{throw Error('GET must not approve a device')}}};
 const api={};new Function('require','exports',ts.transpileModule(fs.readFileSync('app/api/device-authorization/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(key=>{if(!(key in dependencies))throw Error(key);return dependencies[key]},api);
 const request=(values={groompro_tenant:'business',groompro_device:'device',groompro_session:'session'})=>({cookies:{get:key=>values[key]?{value:values[key]}:undefined}});
 return {api,db,calls,request,setSession:value=>session=value,setApproved:value=>approved=value};
}
test('active Platform Owner and Developer use PIN access without enrolling the tenant device',async()=>{
 const f=fixture();for(const role of ['PLATFORM_OWNER','DEVELOPER']){f.setSession({user:{role}});const response=await f.api.GET(f.request());assert.deepEqual(response.body,{approved:false,platformAccess:true});assert.equal(response.headers['Cache-Control'],'no-store');assert.deepEqual(f.calls.at(-1),[f.db,'business','session','device']);}
});
test('ordinary staff and tenant owners still require device approval',async()=>{
 const f=fixture();for(const role of ['ADMIN','MANAGER','GROOMER']){f.setSession({user:{role}});assert.deepEqual((await f.api.GET(f.request())).body,{approved:false,platformAccess:false});}
 f.setApproved(true);assert.deepEqual((await f.api.GET(f.request())).body,{approved:true,platformAccess:false});
});
test('expired or revoked sessions and missing device/session cookies cannot grant platform access',async()=>{
 const f=fixture();assert.deepEqual((await f.api.GET(f.request())).body,{approved:false,platformAccess:false});
 f.setSession({user:{role:'PLATFORM_OWNER'}});const previous=f.calls.length;
 for(const values of [{groompro_tenant:'business',groompro_device:'device'},{groompro_tenant:'business',groompro_session:'session'}])assert.equal((await f.api.GET(f.request(values))).body.platformAccess,false);
 assert.equal(f.calls.length,previous);
});
