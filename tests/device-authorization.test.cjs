const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),crypto=require('node:crypto');
function fixture(){
 const rows=new Map(),sent=[];const users=[{id:'oa',tenantId:'a',email:'owner@example.invalid',tenant:{name:'Shop A'}},{id:'ob',tenantId:'b',email:'owner@example.invalid',tenant:{name:'Shop B'}}];
 for(const u of users)rows.set(u.tenantId+':BUSINESS_OWNER',{tenantId:u.tenantId,settingKey:'BUSINESS_OWNER',value:{userId:u.id}});
 const key=w=>{const v=w.tenantId_settingKey;return v.tenantId+':'+v.settingKey};
 const db={user:{findMany:async({where})=>users.filter(u=>u.email===where.email)},$queryRaw:async()=>[],auditEntry:{create:async()=>{}},tenantSetting:{
 findUnique:async({where})=>rows.get(key(where)),findFirst:async({where})=>[...rows.values()].find(r=>r.settingKey===where.settingKey),
 create:async({data})=>{rows.set(data.tenantId+':'+data.settingKey,data);return data},
 upsert:async({where,create,update})=>{const k=key(where),row=rows.has(k)?{...rows.get(k),...update}:create;rows.set(k,row);return row},
 update:async({where,data})=>{const k=key(where),row={...rows.get(k),...data};rows.set(k,row);return row},delete:async({where})=>rows.delete(key(where))}};
 let tail=Promise.resolve();db.$transaction=fn=>{const next=tail.then(()=>fn(db));tail=next.catch(()=>{});return next};
 const deps={'node:crypto':crypto,'./db':{db},'./device-password':{devicePolicyKey:'DEVICE_AUTH_POLICY',deviceEmailVerifiedKey:'DEVICE_EMAIL_VERIFIED',checkDevicePassword:async(password,stored)=>password===stored},'./platform-business':{businessOwnerKey:'BUSINESS_OWNER'},'./platform-restrictions':{platformRestriction:async()=>null}};
 const source=ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../src/lib/device-authorization.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};
 const fakeFetch=async(url,request)=>{sent.push(JSON.parse(request.body));return {ok:true}};
 new Function('require','exports','fetch','process',source)(k=>deps[k],exports,fakeFetch,{env:{GROOMPRO_AGREEMENT_EMAIL_TENANTS_JSON:JSON.stringify({a:{apiKey:'test',from:'test@example.invalid'},b:{apiKey:'test',from:'test@example.invalid'}})}});
 return {...exports,rows,sent,code:()=>sent.at(-1).text.match(/code is (\d{6})/)[1]};
}
test('one owner email can verify and choose either tenant, but approval belongs to one tenant and device',async()=>{
 const f=fixture(),token=await f.sendDeviceCode('OWNER@example.invalid');
 assert.deepEqual(await f.verifyDeviceCode(token,f.code()),[{id:'a',name:'Shop A'},{id:'b',name:'Shop B'}]);
 const proof=await f.approveDevice(token,'b','device');
 assert.equal(await f.deviceApproved('b','device',proof),true);
 assert.equal(await f.deviceApproved('a','device',proof),false);
 assert.equal(await f.deviceApproved('b','other-device',proof),false);
 await assert.rejects(f.approveDevice(token,'a','device'),/new verification code/);
});
test('an unverified or expired code cannot authorize a device or expose business choices',async()=>{
 const f=fixture(),token=await f.sendDeviceCode('owner@example.invalid');
 await assert.rejects(f.approveDevice(token,'a','device'),/Verify/);
 const challenge=[...f.rows.values()].find(r=>r.settingKey.startsWith('DEVICE_CHALLENGE:'));challenge.value.expiresAt=0;
 await assert.rejects(f.verifyDeviceCode(token,f.code()),/incorrect or expired/);
});
test('five wrong codes lock that challenge; a verified owner cannot select an unrelated tenant',async()=>{
 const f=fixture(),token=await f.sendDeviceCode('owner@example.invalid'),bad=f.code()==='000000'?'111111':'000000';
 for(let i=0;i<5;i++)await assert.rejects(f.verifyDeviceCode(token,bad),/incorrect or expired/);
 await assert.rejects(f.verifyDeviceCode(token,f.code()),/incorrect or expired/);
 const next=await f.sendDeviceCode('owner@example.invalid');await f.verifyDeviceCode(next,f.code());
 await assert.rejects(f.approveDevice(next,'unrelated','device'),/belonging to this owner/);
});
test('unknown emails receive no business details or email, and resend limits are persisted',async()=>{
 const f=fixture(),unknown=await f.sendDeviceCode('unknown@example.invalid');assert.equal(unknown.length,64);assert.equal(f.sent.length,0);
 for(let i=0;i<3;i++)await f.sendDeviceCode('owner@example.invalid');
 await assert.rejects(f.sendDeviceCode('owner@example.invalid'),/wait a minute/);
});

async function pinAttempt(role,approved){
 let started=false;
 const user={id:'user',role,pinHash:'hash',pinPrefixHashes:[]};
 const deps={
 '@/src/lib/device-authorization':{deviceApprovalCookie:'groompro_device_approval',deviceApproved:async()=>approved},
 '@/src/lib/roles':{isPlatformRole:role=>['PLATFORM_OWNER','DEVELOPER'].includes(role)},
 '@/src/lib/pin-vault':{pinVaultConfigured:()=>false},'@/src/lib/platform-restrictions':{platformRestriction:async()=>null},
 'node:crypto':crypto,'@/src/lib/audit':{},'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200,cookies:{set(){}}})}},
 '@/src/lib/db':{db:{user:{findMany:async()=>[user]}}},
 '@/src/lib/pin':{hasUsablePinHash:()=>true,verifyPin:async()=>true},
 '@/src/lib/employee-session':{createDeviceId:()=> 'device',startEmployeeSession:async()=>{started=true;return {id:'session',user}}},
 '@/src/lib/pin-attempts':{allowPinAttempt:async()=>true},'@/src/lib/business-context':{businessId:()=>false},'@/src/lib/platform-business':{}
 };
 const source=ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../app/api/employee/session/route.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};
 new Function('require','exports',source)(k=>deps[k],exports);
 const response=await exports.POST({headers:{get:()=> 'tenant'},cookies:{get:()=>({value:'device'})},json:async()=>({pin:'123456'})});
 return {response,started};
}
test('ordinary employee PINs require owner device verification before a session starts',async()=>{
 const denied=await pinAttempt('ADMIN',false);assert.equal(denied.response.status,401);assert.equal(denied.response.body.deviceVerificationRequired,true);assert.equal(denied.started,false);
 const allowed=await pinAttempt('GROOMER',true);assert.equal(allowed.response.status,200);assert.equal(allowed.started,true);
});
test('Platform Owner and Developer PIN access remains available without a tenant email',async()=>{
 for(const role of ['PLATFORM_OWNER','DEVELOPER']){const result=await pinAttempt(role,false);assert.equal(result.response.status,200);assert.equal(result.started,true);}
});

test('password choice requires first email verification and never grants another tenant sharing the email',async()=>{
 const f=fixture();
 for(const id of ['a','b'])f.rows.set(id+':DEVICE_AUTH_POLICY',{tenantId:id,settingKey:'DEVICE_AUTH_POLICY',value:{mode:'PASSWORD',passwordHash:id+' password',revision:1}});
 await assert.rejects(f.verifyDevicePassword('owner@example.invalid','a password'),/not recognized/);
 f.rows.set('a:DEVICE_EMAIL_VERIFIED',{tenantId:'a',settingKey:'DEVICE_EMAIL_VERIFIED',value:true});
 const result=await f.verifyDevicePassword('owner@example.invalid','a password');assert.deepEqual(result.businesses,[{id:'a',name:'Shop A'}]);
 await assert.rejects(f.approveDevice(result.token,'b','device'),/belonging/);
 assert.equal(await f.deviceApproved('a','device',await f.approveDevice(result.token,'a','device')),true);
 const code=await f.sendDeviceCode('owner@example.invalid');assert.deepEqual(await f.verifyDeviceCode(code,f.code()),[{id:'b',name:'Shop B'}]);
});
