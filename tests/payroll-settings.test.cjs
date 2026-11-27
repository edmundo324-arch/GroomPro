require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const payroll=require('../src/lib/payroll-pay-methods.ts'),roles=require('../src/lib/roles.ts');
function fixture(){
 const rows=new Map(),audits=[],locks=[],users=[{id:'one',tenantId:'a',role:'GROOMER'},{id:'two',tenantId:'a',role:'BACK'},{id:'foreign',tenantId:'b',role:'GROOMER'},{id:'owner',tenantId:'a',role:'PLATFORM_OWNER'},{id:'restricted',tenantId:'a',role:'GROOMER'}];let role='MANAGER',signedIn=true,failAudit=false;
 const key=value=>value.tenantId+'|'+value.settingKey;
 const tx={tenantSetting:{findMany:async({where})=>[...rows].filter(([id])=>id.startsWith(where.tenantId+'|')).map(([id,value])=>({settingKey:id.split('|')[1],value})).filter(row=>!where.NOT.some(({settingKey})=>typeof settingKey==='string'?row.settingKey===settingKey:row.settingKey.startsWith(settingKey.startsWith))),findUnique:async({where})=>{const value=rows.get(key(where.tenantId_settingKey));return value?{value:structuredClone(value)}:null},upsert:async({where,create,update})=>{const name=key(where.tenantId_settingKey);rows.set(name,structuredClone(rows.has(name)?update.value:create.value))}},user:{findFirst:async({where})=>users.find(user=>user.id===where.id&&user.tenantId===where.tenantId)||null},$queryRaw:async parts=>{locks.push(parts.join('?'));return []},auditEntry:{create:async({data})=>{if(failAudit)throw Error('Audit could not be saved.');audits.push(data)}}};
 const db={...tx,$transaction:async run=>{const snapshot=structuredClone(rows),count=audits.length;try{return await run(tx)}catch(error){rows.clear();for(const [k,v] of snapshot)rows.set(k,v);audits.length=count;throw error}}};
 const dependencies={'next/server':{NextResponse:{json:(data,options)=>({data,status:options?.status||200,headers:options?.headers})}},db:{db},'employee-session':{getActiveEmployeeSession:async tenantId=>signedIn?{tenantId,user:{id:'manager',role}}:null},'request-policy':{withRequestPolicy:(handler,policy)=>{assert.equal(policy.configure,true);return handler}},roles,'platform-restrictions':{platformRestriction:async(_tenant,id)=>id==='restricted'?'Restricted':null},'payroll-pay-methods':payroll};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/payroll-settings/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,process,require:id=>dependencies[id==='next/server'?id:id.split('/').at(-1)]});
 const general={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/business-settings/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:general,process,require:id=>dependencies[id==='next/server'?id:id.split('/').at(-1)]});
 const request=(method,tenant,userId,body)=>({method,headers:{get:name=>name==='x-tenant-id'?tenant:null},cookies:{get:()=>({value:'session'})},nextUrl:{searchParams:new URLSearchParams(userId?{userId}:{})},json:async()=>body});
 return {rows,audits,locks,general:()=>general.GET(request('GET','a')),as:value=>role=value,signOut:()=>signedIn=false,failAudit:()=>failAudit=true,get:(userId,tenant='a')=>exports.GET(request('GET',tenant,userId)),put:(body,tenant='a')=>exports.PUT(request('PUT',tenant,'',body))};
}
const employee=(userId,method,revision=0,businessRevision=0)=>({scope:'EMPLOYEE',userId,method,revision,businessRevision});
const business=(mode,commonMethod,revision=0)=>({scope:'BUSINESS',mode,commonMethod,revision});

test('factory payroll mode is per employee with no invented employee method or amount',async()=>{
 const f=fixture(),response=await f.get('one');assert.equal(response.status,200);assert.deepEqual(response.data.settings,{mode:'PER_EMPLOYEE',commonMethod:null,revision:0});assert.deepEqual(response.data.employee,{method:null,revision:0,effectiveMethod:null});assert.equal(response.data.preparationNotice,'Payroll payments and tax filings are not connected.');assert.equal(response.headers['Cache-Control'],'no-store');assert.equal(f.rows.size,0);
});
test('shared mode changes effective choices while retaining each saved employee method and isolating businesses',async()=>{
 const f=fixture();assert.equal((await f.put(employee('one','HOURLY'))).status,200);assert.equal((await f.put(employee('two','SALARY'))).status,200);
 assert.equal((await f.put(business('COMMON','COMMISSION_ONLY'))).status,200);
 const one=(await f.get('one')).data,two=(await f.get('two')).data;assert.equal(one.employee.method,'HOURLY');assert.equal(two.employee.method,'SALARY');assert.equal(one.employee.effectiveMethod,'COMMISSION_ONLY');assert.equal(two.employee.effectiveMethod,'COMMISSION_ONLY');
 assert.equal((await f.put(employee('one','HOURLY_PLUS_COMMISSION',1,1))).status,409,'Individual writes cannot bypass common mode');
 assert.equal((await f.put(business('PER_EMPLOYEE','COMMISSION_ONLY',1))).status,200);assert.equal((await f.get('one')).data.employee.effectiveMethod,'HOURLY');assert.equal((await f.get('two')).data.employee.effectiveMethod,'SALARY');
 assert.equal((await f.get('foreign','b')).data.employee.method,null);assert.equal((await f.get(undefined,'b')).data.settings.mode,'PER_EMPLOYEE');assert.ok(f.locks.every(sql=>sql.includes('FROM Tenant')));
});
test('only listed methods and assignment modes are saved, and shared mode requires a method',async()=>{
 const f=fixture();for(const body of [business('OTHER','HOURLY'),business('COMMON',null),business('COMMON','CASH'),employee('one',''),employee('one',null),employee('one','GUSTO'),{scope:'OTHER'}]){assert.equal((await f.put(body)).status,400,JSON.stringify(body));assert.equal(f.rows.size,0)}
 let revision=0;for(const [method] of payroll.payrollPayMethods){const response=await f.put(employee('one',method,revision++));assert.equal(response.status,200);assert.equal(response.data.employee.effectiveMethod,method);assert.deepEqual(Object.keys(response.data.employee).sort(),['effectiveMethod','method','revision'])}
});
test('stale settings or employee revisions reject writes without replacing newer choices',async()=>{
 const f=fixture();await f.put(employee('one','HOURLY'));assert.equal((await f.put(employee('one','SALARY'))).status,409);assert.equal((await f.get('one')).data.employee.method,'HOURLY');
 await f.put(business('PER_EMPLOYEE',null));assert.equal((await f.put(employee('one','SALARY',1,0))).status,409);assert.equal((await f.put(business('COMMON','SALARY',0))).status,409);assert.equal((await f.get()).data.settings.mode,'PER_EMPLOYEE');
});
test('payroll views and writes require manager authority and respect employee tenant and platform protections',async()=>{
 const f=fixture();for(const role of ['FRONT','BACK','GROOMER']){f.as(role);assert.equal((await f.get()).status,403);assert.equal((await f.put(business('COMMON','HOURLY'))).status,403)}
 f.as('MANAGER');assert.equal((await f.get('foreign')).status,404);assert.equal((await f.put(employee('foreign','SALARY'))).status,404);assert.equal((await f.get('owner')).status,403);assert.equal((await f.put(employee('restricted','HOURLY'))).status,403);
 f.as('PLATFORM_OWNER');assert.equal((await f.put(employee('owner','HOURLY_PLUS_COMMISSION'))).status,200);f.signOut();assert.equal((await f.get()).status,401);assert.equal((await f.put(business('COMMON','HOURLY'))).status,401);
});
test('configuration and its audit record commit together without touching wage or commission records',async()=>{
 const f=fixture();f.failAudit();assert.equal((await f.put(employee('one','WHICHEVER_IS_HIGHER'))).status,400);assert.equal(f.rows.size,0);assert.equal(f.audits.length,0);
});
test('payroll setup is discoverable for managers with a valid Settings breadcrumb',()=>{
 const {findSettings,settingsBreadcrumb}=require('../src/lib/settings-search.ts'),matches=findSettings('payroll','MANAGER');assert.ok(matches.some(item=>item.path[0]==='payroll'));assert.ok(matches.filter(item=>item.path[0]==='payroll').every(item=>settingsBreadcrumb(item).startsWith('Settings → Payroll')));assert.equal(findSettings('payroll','FRONT').some(item=>item.path[0]==='payroll'),false);
});

test('general business settings never disclose protected pay choices or payroll setup',async()=>{
 const f=fixture();await f.put(employee('one','SALARY'));await f.put(business('COMMON','WHICHEVER_IS_HIGHER'));f.rows.set('a|EMPLOYEE_HR:one',{emergencyPhone:'private'});f.rows.set('a|primaryColor','#123456');f.as('FRONT');
 const response=await f.general();assert.equal(response.status,200);assert.equal(response.data.settings.primaryColor,'#123456');assert.deepEqual(Object.keys(response.data.settings),['primaryColor']);
});
