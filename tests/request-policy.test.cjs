const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {AsyncLocalStorage}=require('node:async_hooks');
function load(file,deps){deps={'./platform-restrictions':{platformRestriction:async()=>null,isDeveloperId:()=>false},...deps};const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(n in deps)return deps[n];throw Error(n)},Date,process,Map});return exports;}
function fixture({permission=true,feature=true,mode='PER_ACTION',approval=false}={}){
 const requestAuthorization=new AsyncLocalStorage(),requestHeaders=new AsyncLocalStorage();let claims=0,approvalUses=0,checks=[],writes=0;
 const session={id:'session',tenantId:'tenant',deviceId:'device',lastActiveAt:new Date(),user:{id:'worker',role:'FRONT',active:true}};
 const db={employeeSession:{findFirst:async({where})=>where.tenantId==='tenant'&&where.id==='session'?session:null,updateMany:async()=>({count:++claims===1?1:0})},rolePermission:{findUnique:async args=>{checks.push(args.where.tenantId_role_permissionCode);return permission===undefined?null:{enabled:permission}}},actionApproval:{findFirst:async()=>approval?{id:'approval',approverId:'manager'}:null,updateMany:async()=>({count:++approvalUses===1?1:0})},user:{findFirst:async()=>({id:'manager',role:'MANAGER',active:true})}};
 const sessionApi=load('src/lib/employee-session.ts',{'./request-authorization':{requestAuthorization},'./action-context':{actionContext:{getStore:()=>undefined}},'next/headers':{headers:async()=>requestHeaders.getStore()},'./workflow-settings':{workflowSettings:async()=>({securityMode:mode,inactivityMinutes:10})},'node:crypto':require('node:crypto'),'./db':{db}});
 const json=(body,opt)=>({status:opt?.status||200,body});
 const {withRequestPolicy}=load('src/lib/request-policy.ts',{'./request-authorization':{requestAuthorization},'next/server':{NextResponse:{json}},'./db':{db},'./employee-session':sessionApi,'./module-entitlement':{moduleDenial:async()=>feature?null:json({error:'disabled'},{status:403})}});
 const handler=withRequestPolicy(async()=>{const [first,second]=await Promise.all([sessionApi.getActiveEmployeeSession('tenant','session'),sessionApi.getActiveEmployeeSession('tenant','session')]);assert.equal(first.user.id,second.user.id);writes++;return json({actor:first.user.id})},{feature:'TICKETS'});
 async function call(tenant='tenant',method='POST',sid='session'){const headers=new Map([['x-tenant-id',tenant],['x-groompro-method',method],...(approval?[['x-groompro-approval','approval'],['x-groompro-request-hash','hash']]:[])]);return requestHeaders.run(headers,()=>handler({method,headers,cookies:{get:name=>name==='groompro_session'&&sid?{value:sid}:undefined}}));}
 return{call,stats:()=>({claims,approvalUses,checks,writes})};
}
test('nested authorization in one operation consumes one PIN grant, not a second PIN',async()=>{const f=fixture();assert.equal((await f.call()).status,200);assert.equal(f.stats().claims,1);assert.equal((await f.call()).status,401);assert.equal(f.stats().writes,1)});
test('one-time manager approval is reused only inside the approved request',async()=>{const f=fixture({approval:true});assert.equal((await f.call()).body.actor,'manager');assert.equal(f.stats().approvalUses,1);assert.equal((await f.call()).status,401);assert.equal(f.stats().writes,1)});
test('role denial prevents handler execution and stays tenant scoped',async()=>{const f=fixture({permission:false});assert.equal((await f.call()).status,403);assert.equal(f.stats().writes,0);assert.deepEqual(f.stats().checks.map(x=>[x.tenantId,x.role,x.permissionCode]),[['tenant','FRONT','CREATE']]);assert.equal((await f.call('other')).status,401)});
test('module denial happens before consuming PIN or running mutations',async()=>{const f=fixture({feature:false});assert.equal((await f.call()).status,403);assert.equal(f.stats().claims,0);assert.equal(f.stats().writes,0)});
test('inactivity mode retains authorization across distinct actions; per-action mode does not',async()=>{const f=fixture({mode:'INACTIVITY'});assert.equal((await f.call()).status,200);assert.equal((await f.call()).status,200);assert.equal(f.stats().claims,0)});
test('missing session or foreign tenant never reaches mutation handler',async()=>{const f=fixture();assert.equal((await f.call('tenant','POST','')).status,401);assert.equal((await f.call('other')).status,401);assert.equal(f.stats().writes,0)});

test('composite checkout requires both create and edit for a new ticket, only edit for an existing ticket',async()=>{
 const {actionPermissions}=load('src/lib/request-policy.ts',{'./request-authorization':{},'next/server':{},'./db':{},'./employee-session':{},'./module-entitlement':{}});
 const request=body=>({method:'POST',nextUrl:{pathname:'/api/pos-operation'},clone:()=>({json:async()=>body})});
 assert.deepEqual(Array.from(await actionPermissions(request({kind:'PAYMENT'}))),['CREATE','EDIT']);
 assert.deepEqual(Array.from(await actionPermissions(request({kind:'PAYMENT',ticketId:'one'}))),['EDIT']);
 assert.deepEqual(Array.from(await actionPermissions(request({kind:'SAVE'}))),['CREATE']);
 assert.deepEqual(Array.from(await actionPermissions({method:'POST',nextUrl:{pathname:'/api/tickets/checkout'}})),['EDIT']);
 assert.deepEqual(Array.from(await actionPermissions({method:'PATCH'},true)),['CONFIGURE']);
});
