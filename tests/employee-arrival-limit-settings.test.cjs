require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {arrivalLimitKey,parseEmployeeArrivalLimit,saveEmployeeArrivalLimit}=require('../src/lib/employee-arrival-limit-settings.ts');
test('arrival limits accept whole appointments and minutes, with null retaining ordinary booking rules',()=>{
 assert.equal(parseEmployeeArrivalLimit(undefined),null);assert.equal(parseEmployeeArrivalLimit(null),null);
 assert.deepEqual(parseEmployeeArrivalLimit({maxAppointments:2,intervalMinutes:30}),{maxAppointments:2,intervalMinutes:30});
 assert.deepEqual(parseEmployeeArrivalLimit({maxAppointments:100,intervalMinutes:1440}),{maxAppointments:100,intervalMinutes:1440});
 for(const value of [false,[],{},'2',{maxAppointments:0,intervalMinutes:30},{maxAppointments:1.5,intervalMinutes:30},{maxAppointments:101,intervalMinutes:30},{maxAppointments:'2',intervalMinutes:30},{maxAppointments:2,intervalMinutes:0},{maxAppointments:2,intervalMinutes:30.5},{maxAppointments:2,intervalMinutes:1441},{maxAppointments:2,intervalMinutes:Infinity}])assert.throws(()=>parseEmployeeArrivalLimit(value));
});
test('setting persistence preserves omission and scopes setting or clearing to this employee and business',async()=>{
 const calls=[],tx={tenantSetting:{upsert:async input=>calls.push(['save',input]),deleteMany:async input=>calls.push(['clear',input])}};
 await saveEmployeeArrivalLimit(tx,'shop','maya',undefined);assert.equal(calls.length,0);
 await saveEmployeeArrivalLimit(tx,'shop','maya',{maxAppointments:2,intervalMinutes:30});assert.deepEqual(calls[0][1],{where:{tenantId_settingKey:{tenantId:'shop',settingKey:'EMPLOYEE_ARRIVAL_LIMIT:maya'}},create:{tenantId:'shop',settingKey:'EMPLOYEE_ARRIVAL_LIMIT:maya',value:{maxAppointments:2,intervalMinutes:30}},update:{value:{maxAppointments:2,intervalMinutes:30}}});
 await saveEmployeeArrivalLimit(tx,'shop','maya',null);assert.deepEqual(calls[1],['clear',{where:{tenantId:'shop',settingKey:arrivalLimitKey('maya')}}]);
 await assert.rejects(saveEmployeeArrivalLimit(tx,'shop','maya',{maxAppointments:0,intervalMinutes:30}));assert.equal(calls.length,2);
});
function fixture({role='MANAGER',failLimit=false,locationId='main'}={}){
 let users=new Map([['maya',{id:'maya',tenantId:'shop',firstName:'Maya',lastName:'Test',displayName:null,role:'GROOMER',active:true,locationId,jobTitle:'Groomer'}],['foreign',{id:'foreign',tenantId:'other',firstName:'Other',lastName:'Person',role:'GROOMER',active:true}]]),settings=new Map([[arrivalLimitKey('maya'),{maxAppointments:2,intervalMinutes:30}],['EMPLOYEE_AVAILABLE_ONLINE:maya',true]]),inTransaction=false;
 const writes=[],audits=[],queries=[],reconciliations=[];
 const db={$queryRaw:async(strings,...values)=>{assert.ok(inTransaction);assert.match(strings.join('?'),/SELECT id FROM Tenant WHERE id = .* FOR UPDATE/);assert.deepEqual(values,['shop']);writes.push(['tenant-lock',values[0]]);return[{id:'shop'}]},user:{findFirst:async({where})=>[...users.values()].find(u=>u.tenantId===where.tenantId&&(where.id?u.id===where.id:u.firstName===where.firstName&&u.lastName===where.lastName))||null,findMany:async query=>{queries.push(query);return [...users.values()].filter(u=>u.tenantId===query.where.tenantId)},update:async({where,data})=>{assert.ok(inTransaction);const value={...users.get(where.id),...data};users.set(where.id,value);writes.push(['profile',where.id]);return value},create:async({data})=>{assert.ok(inTransaction);const value={...data,id:'new-employee'};users.set(value.id,value);writes.push(['profile',value.id]);return value}},location:{findFirst:async({where})=>where.tenantId==='shop'&&['main','second'].includes(where.id)?{id:where.id}:null},tenantSetting:{findUnique:async({where})=>{const key=where.tenantId_settingKey;return key.tenantId==='shop'&&settings.has(key.settingKey)?{value:settings.get(key.settingKey)}:null},findMany:async query=>{queries.push(query);return [...settings].filter(([key])=>query.where.tenantId==='shop'&&query.where.settingKey.in.includes(key)).map(([settingKey,value])=>({settingKey,value}))},upsert:async input=>{assert.ok(inTransaction);const key=input.where.tenantId_settingKey;assert.equal(key.tenantId,'shop');if(failLimit&&key.settingKey.startsWith('EMPLOYEE_ARRIVAL_LIMIT:'))throw Error('Fixture setting failure');settings.set(key.settingKey,input.update.value);writes.push(['setting',key.settingKey])},deleteMany:async({where})=>{assert.ok(inTransaction);assert.equal(where.tenantId,'shop');settings.delete(where.settingKey);writes.push(['clear',where.settingKey])}}};
 db.$transaction=async fn=>{const beforeUsers=new Map(users),beforeSettings=new Map(settings);inTransaction=true;try{return await fn(db)}catch(e){users=beforeUsers;settings=beforeSettings;throw e}finally{inTransaction=false}};
 const dependencies={
  '@/src/lib/employee-arrival-limit-settings':{arrivalLimitKey,parseEmployeeArrivalLimit,saveEmployeeArrivalLimit},'@/src/lib/online-booking-resources':require('../src/lib/online-booking-resources.ts'),'@/src/lib/roles':require('../src/lib/roles.ts'),'@/src/lib/platform-restrictions':{platformRestriction:async()=>null},'@/src/lib/request-policy':{hidePlatformOwners:async()=>false,withRequestPolicy:fn=>fn},'@/src/lib/groomer-assignment':{reconcileEmployeeAssignments:async tenantId=>reconciliations.push(tenantId)},'@/src/lib/audit':{writeAudit:async input=>audits.push(input)},'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},'@/src/lib/db':{db},'@/src/lib/employee-session':{getActiveEmployeeSession:async()=>role?{user:{id:'manager',role}}:null},'@/src/lib/request-location':{requestLocation:async()=> 'main'},'@/src/lib/platform-business':{platformHome:async()=>null},'@/src/lib/employee-pin-assignment':{saveWithPin:async(tenantId,pin,id,data,tx)=>id?tx.user.update({where:{id},data}):tx.user.create({data})}
 };
 const exports={},source=ts.transpileModule(fs.readFileSync('app/api/employees/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports',source)(id=>{if(!(id in dependencies))throw Error(id);return dependencies[id]},exports);
 return {api:exports,writes,audits,queries,reconciliations,user:()=>users.get('maya'),setting:id=>settings.get(arrivalLimitKey(id)),request:(body={},method='PATCH')=>({method,headers:{get:name=>name==='x-tenant-id'?'shop':null},cookies:{get:()=>({value:'session'})},json:async()=>body})};
}
test('employee listing returns each saved arrival limit and existing online availability with tenant scope',async()=>{
 const f=fixture(),r=await f.api.GET(f.request({},'GET'));assert.equal(r.status,200);assert.equal(r.body.employees.length,1);assert.deepEqual(r.body.employees[0].arrivalLimit,{maxAppointments:2,intervalMinutes:30});assert.equal(r.body.employees[0].availableOnline,true);assert.ok(f.queries.every(q=>q.where.tenantId==='shop'));
 await f.api.PATCH(f.request({id:'maya',arrivalLimit:null}));const cleared=await f.api.GET(f.request({},'GET'));assert.equal(cleared.body.employees[0].arrivalLimit,null);assert.equal(cleared.body.employees[0].availableOnline,true);
});
test('profile and arrival changes commit together; omitted values retain the saved limit',async()=>{
 const f=fixture();let r=await f.api.PATCH(f.request({id:'maya',displayName:'Maya G'}));assert.equal(r.status,200);assert.deepEqual(f.setting('maya'),{maxAppointments:2,intervalMinutes:30});assert.equal(f.writes.length,1);
 r=await f.api.PATCH(f.request({id:'maya',displayName:'Maya',arrivalLimit:{maxAppointments:3,intervalMinutes:45}}));assert.equal(r.status,200);assert.deepEqual(f.setting('maya'),{maxAppointments:3,intervalMinutes:45});assert.equal(f.user().displayName,'Maya');assert.deepEqual(f.audits.at(-1).details.arrivalLimit,{maxAppointments:3,intervalMinutes:45});
 const failure=fixture({failLimit:true});r=await failure.api.PATCH(failure.request({id:'maya',displayName:'Must Roll Back',arrivalLimit:{maxAppointments:3,intervalMinutes:45}}));assert.equal(r.status,409);assert.equal(failure.user().displayName,null);assert.deepEqual(failure.setting('maya'),{maxAppointments:2,intervalMinutes:30});assert.equal(failure.audits.length,0);
});
test('new employee arrival limits save with profile creation and reject invalid input before writes',async()=>{
 const f=fixture();const body={firstName:'Abby',lastName:'Example',role:'GROOMER',pin:'123456',arrivalLimit:{maxAppointments:2,intervalMinutes:30}};assert.equal((await f.api.POST(f.request(body,'POST'))).status,201);assert.deepEqual(f.setting('new-employee'),body.arrivalLimit);
 for(const method of ['POST','PATCH']){const invalid=fixture();const r=await invalid.api[method](invalid.request({...body,id:'maya',arrivalLimit:{maxAppointments:0,intervalMinutes:30}},method));assert.equal(r.status,400);assert.equal(invalid.writes.length,0);}
});
test('arrival limits retain manager, role and employee tenant protections',async()=>{
 for(const [role,status] of [[null,401],['BACK',403]]){const f=fixture({role});assert.equal((await f.api.PATCH(f.request({id:'maya',arrivalLimit:null}))).status,status);assert.equal(f.writes.length,0);}
 const f=fixture();assert.equal((await f.api.PATCH(f.request({id:'foreign',arrivalLimit:null}))).status,404);assert.equal(f.writes.length,0);
});
test('arrival-only and unchanged profile saves leave existing assignments alone; actual availability changes still reconcile',async()=>{
 const f=fixture();
 assert.equal((await f.api.PATCH(f.request({id:'maya',firstName:'Maya',lastName:'Test',role:'GROOMER',jobTitle:'Groomer',active:true,locationId:'main',arrivalLimit:{maxAppointments:1,intervalMinutes:60}}))).status,200);
 assert.equal((await f.api.PATCH(f.request({id:'maya',arrivalLimit:null}))).status,200);
 assert.equal((await f.api.PATCH(f.request({id:'maya',displayName:'Maya Groomer',pin:'123456'}))).status,200);
 assert.deepEqual(f.reconciliations,[],'Booking policy and cosmetic/PIN changes must not revisit appointments');
 assert.equal((await f.api.PATCH(f.request({id:'maya',locationId:'second'}))).status,200);assert.deepEqual(f.reconciliations,['shop']);
 assert.equal((await f.api.PATCH(f.request({id:'maya',active:false}))).status,200);assert.deepEqual(f.reconciliations,['shop','shop']);
 assert.equal((await f.api.PATCH(f.request({id:'maya',active:false,locationId:'second'}))).status,200);assert.equal(f.reconciliations.length,2,'Resaving the same availability does not reconcile again');
});

test('arrival-limit writes acquire the booking tenant lock before profile or settings mutation',async()=>{
 for(const method of ['POST','PATCH'])for(const arrivalLimit of [null,{maxAppointments:2,intervalMinutes:30}]){
  const f=fixture(),body={id:'maya',firstName:'Abby',lastName:'Example',role:'GROOMER',pin:'123456',arrivalLimit};
  assert.equal((await f.api[method](f.request(body,method))).status,method==='POST'?201:200);
  assert.deepEqual(f.writes[0],['tenant-lock','shop']);assert.equal(f.writes[1][0],'profile');
  assert.ok(f.writes.slice(2).some(([kind,key])=>['setting','clear'].includes(kind)&&key.startsWith('EMPLOYEE_ARRIVAL_LIMIT:')));
 }
 const unchanged=fixture();assert.equal((await unchanged.api.PATCH(unchanged.request({id:'maya',displayName:'Maya G'}))).status,200);
 assert.deepEqual(unchanged.writes,[['profile','maya']],'Omitted limits do not add an unnecessary booking lock');
});

test('new employees keep the existing current-location fallback and save selected locations',async()=>{
 for(const locationId of ['',null,'main','second',undefined]){
  const f=fixture(),body={firstName:'Sales',lastName:'Example',role:'SALES',pin:'123456',...(locationId===undefined?{}:{locationId})};
  const result=await f.api.POST(f.request(body,'POST'));assert.equal(result.status,201);
  assert.equal(result.body.employee.locationId,locationId||'main');
  assert.equal(result.body.employee.role,'SALES','The readable outside-marketing label preserves the existing permission role');
 }
});
test('editing an employee preserves omitted locations, clears explicit no-location and saves a selected location',async()=>{
 const f=fixture();let result=await f.api.PATCH(f.request({id:'maya',role:'SALES'}));assert.equal(result.status,200);assert.equal(f.user().locationId,'main');assert.equal(f.user().role,'SALES');
 for(const locationId of ['', 'second', null, 'main']){result=await f.api.PATCH(f.request({id:'maya',locationId}));assert.equal(result.status,200);assert.equal(f.user().locationId,locationId||null);}
 assert.equal((await f.api.PATCH(f.request({id:'maya',locationId:'foreign-location'}))).status,400);assert.equal(f.user().locationId,'main');
});

test('an existing missing-location employee can save unrelated changes without an automatic assignment',async()=>{
 const f=fixture({locationId:null});const result=await f.api.PATCH(f.request({id:'maya',locationId:'',displayName:'Maya G'}));
 assert.equal(result.status,200);assert.equal(f.user().locationId,null);assert.equal(f.user().displayName,'Maya G');assert.deepEqual(f.reconciliations,[]);
});
