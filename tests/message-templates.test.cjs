const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');require('./load-ts.cjs');
const helpers=require('../src/lib/message-templates.ts');
const {validateLibrary}=require('../src/lib/business-libraries.ts');
test('saved messages validate variables and require actual context',()=>{
 assert.throws(()=>helpers.renderMessageTemplate('Hello {customer}; {appointmentTime}',{customer:'Maria'},'SMS'),/unavailable/);
 assert.throws(()=>validateLibrary('message-templates',[{id:'a',name:'Message',channel:'SMS',text:'Hello {unknown}'}]),/listed automatic/);
 assert.throws(()=>helpers.renderMessageTemplate('{customer}',{customer:'a'.repeat(1601)},'SMS'),/too long/);
 assert.equal(helpers.renderMessageTemplate('Hello {customer}, from {business}',{customer:'Maria',business:'Grand Grooming'},'EMAIL'),'Hello Maria, from Grand Grooming');
});
function fixture(){
 let authenticated=true;const policy=[];
 const customer={id:'c',firstName:'Maria',lastName:'Smith',tenant:{name:'Grand Grooming'},pets:[{name:'Coco'}]};
 const ticket={id:'t',orderNumber:123,status:'CONFIRMED',scheduledStart:new Date('2026-11-20T16:00:00Z'),location:{name:'North',timezone:'America/Chicago'},pets:[{pet:{name:'Gizmo'}}]};
 const deps={'next/server':{NextResponse:{json:(body,opts)=>({body,status:opts?.status||200})}},'@/src/lib/platform-access':{platformSession:async()=>authenticated?{tenantId:'tenant'}:null},'@/src/lib/request-policy':{withRequestPolicy:(f,p)=>{policy.push(p);return f}},'@/src/lib/message-templates':helpers,'@/src/lib/db':{db:{tenantSetting:{findUnique:async({where})=>{assert.equal(where.tenantId_settingKey.tenantId,'tenant');return {value:{rows:[{id:'template',channel:'SMS',active:true,text:'{customer}: {pets} at {appointmentTime} in {location}.'}]}}}},customer:{findFirst:async({where})=>{assert.equal(where.tenantId,'tenant');return where.id==='c'?customer:null}},ticket:{findFirst:async({where})=>{assert.equal(where.tenantId,'tenant');assert.equal(where.customerId,'c');return where.id==='t'?ticket:null},findMany:async({where})=>{assert.equal(where.tenantId,'tenant');assert.equal(where.customerId,'c');return [ticket]}}}}};
 const api={};new Function('require','exports',ts.transpileModule(fs.readFileSync('app/api/message-templates/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(k=>deps[k],api);
 return {policy,logout:()=>authenticated=false,call:(method,input)=>api[method]({method,nextUrl:{searchParams:new URLSearchParams(input)},json:async()=>input})};
}
test('template expansion uses selected appointment pets and shop timezone without sending',async()=>{const f=fixture();const r=await f.call('POST',{customerId:'c',channel:'SMS',templateId:'template',ticketId:'t'});assert.equal(r.status,200);assert.equal(r.body.body,'Maria Smith: Gizmo at 10:00 AM in North.');assert.ok(f.policy.every(p=>p.feature==='MESSAGING'));});
test('template expansion rejects wrong customer, appointment, channel and missing appointment context',async()=>{const f=fixture(),base={customerId:'c',channel:'SMS',templateId:'template',ticketId:'t'};assert.equal((await f.call('POST',{...base,customerId:'other'})).status,404);assert.equal((await f.call('POST',{...base,ticketId:'other'})).status,404);assert.equal((await f.call('POST',{...base,channel:'EMAIL'})).status,400);assert.equal((await f.call('POST',{...base,ticketId:''})).status,400);f.logout();assert.equal((await f.call('GET',base)).status,401);});

test('settings search resolves every registered destination including templates and device access',()=>{const {settingsSearchEntries,settingsBreadcrumb,findSettings}=require('../src/lib/settings-search.ts');for(const entry of settingsSearchEntries)assert.ok(settingsBreadcrumb(entry).startsWith('Settings'));assert.ok(findSettings('message templates','PLATFORM_OWNER').some(e=>e.title==='Message templates'));assert.ok(findSettings('device','PLATFORM_OWNER').some(e=>e.title==='Device access'));});
