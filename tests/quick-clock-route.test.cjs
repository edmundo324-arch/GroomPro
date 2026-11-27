const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), ts=require('typescript');
require('./load-ts.cjs');
function load(file,deps){
 const exports={};
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',js)(id=>{if(!(id in deps))throw Error('Missing '+id);return deps[id]},exports);
 return exports;
}
test('PIN punches share the manager clock record, preserve the cashier session and reject duplicates',async()=>{
 let row,approved=true;const audits=[];
 const user={id:'worker',role:'GROOMER',firstName:'Maya',pinHash:'valid'};
 const db={user:{findMany:async()=>[user]},rolePermission:{findUnique:async()=>null},$queryRaw:async()=>[],
  tenantSetting:{findUnique:async()=>row,upsert:async({create})=>{row=create}},
  auditEntry:{create:async({data})=>audits.push(data)}};
 db.$transaction=fn=>fn(db);
 const server={'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}}};
 const writer=load('src/lib/save-time-clock.ts',{'node:crypto':require('node:crypto'),'./db':{db},'./time-clock':require('../src/lib/time-clock.ts'),'./offline-transaction':{offlineCreateId:()=>null}});
 const roles={isPlatformRole:()=>false};
 const punch=load('src/lib/quick-punch.ts',{...server,'./db':{db},'./feature-access':{isFeatureEnabled:async()=>true},'./roles':roles,'./request-location':{requestLocation:async()=>'shop'},'./save-time-clock':writer});
 const api=load('app/api/employee/session/route.ts',{...server,'@/src/lib/db':{db},'node:crypto':require('node:crypto'),'@/src/lib/quick-punch':punch,'@/src/lib/roles':roles,'@/src/lib/device-authorization':{deviceApproved:async()=>approved},'@/src/lib/pin-vault':{},'@/src/lib/platform-restrictions':{platformRestriction:async()=>null},'@/src/lib/audit':{},'@/src/lib/pin':{verifyPin:async pin=>pin==='1234',hasUsablePinHash:()=>true},'@/src/lib/employee-session':{},'@/src/lib/pin-attempts':{allowPinAttempt:async()=>true},'@/src/lib/business-context':{businessId:()=>true},'@/src/lib/platform-business':{}});
 const post=(action,pin='1234')=>api.POST({headers:new Headers({'x-tenant-id':'test'}),cookies:{get:()=>({value:'station'})},json:async()=>({action,pin,mode:'QUICK_CLOCK'})});
 assert.equal((await post('IN','9999')).status,401);
 approved=false;assert.equal((await post('IN')).status,401);approved=true;
 assert.equal((await post('IN')).status,200);assert.equal((await post('IN')).status,409);
 assert.equal((await post('OUT')).status,200);assert.equal(row.settingKey,'TIME_CLOCK:worker');
 assert.equal(row.value.shifts.length,1);assert.ok(row.value.shifts[0].end);
 assert.deepEqual(audits.map(a=>[a.actorUserId,a.action]),[['worker','TIME_CLOCK_IN'],['worker','TIME_CLOCK_OUT']]);
});
