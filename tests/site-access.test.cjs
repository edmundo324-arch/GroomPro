require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {NextRequest}=require('next/server'),deployment=require('../scripts/site-deployment.cjs');
function fixture(role,userRole='FRONT'){
 const env={GROOMPRO_SITE_ROLE:role,GROOMPRO_SITE_HOSTS:role+'.example.com'},out={};
 const deps={
  'next/server':require('next/server'),
  './src/lib/site-deployment':{siteRole:()=>deployment.siteRole(env),allowsHost:h=>deployment.allowsHost(h,env),validateDeployment:()=>deployment.validateDeployment(env)},
  './src/lib/business-context':require('../src/lib/business-context.ts'),
  './src/lib/request-fingerprint':require('../src/lib/request-fingerprint.ts'),
  './src/lib/business-host':{requestBusinessHost:()=>({kind:'legacy'})},
  './src/lib/db':{db:{}},
  './src/lib/platform-business':{currentBusinessSession:async(db,t,s,d)=>s==='valid'&&d==='device'?{user:{role:userRole}}:null}
 };
 new Function('require','exports',ts.transpileModule(fs.readFileSync('middleware.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>deps[id],out);
 return (path='/',signed=false,host=role+'.example.com',options={})=>out.middleware(new NextRequest('https://'+host+path,{...options,headers:{host,...options.headers,...(signed?{cookie:'groompro_tenant=home; groompro_session=valid; groompro_device=device'}:{})}}));
}
test('sales serves its public page but never exposes business routes or alternate pages',async()=>{
 const run=fixture('sales');assert.equal((await run()).status,200);
 for(const path of ['/api/tickets','/api/setup/context','/workspace','/setup'])assert.equal((await run(path,true)).status,404);
 assert.equal((await run('/',false,'wrong.example.com')).status,404);
});
test('administration and developer APIs require a verified platform identity',async()=>{
 for(const role of ['admin','development']){
  assert.equal((await fixture(role)('/api/tickets')).status,401);
  assert.equal((await fixture(role)('/api/tickets',true)).status,403);
  assert.equal((await fixture(role,'PLATFORM_OWNER')('/api/tickets',true)).status,200);
  assert.equal((await fixture(role,'DEVELOPER')('/api/subscriptions',true)).status,200);
  assert.equal((await fixture(role)('/api/setup/context')).status,200);
 }
});
test('staging requires sign-in even for the original business',async()=>{
 assert.equal((await fixture('staging')('/api/customers')).status,401);
 assert.equal((await fixture('staging')('/api/customers',true)).status,200);
});

test('only authenticated loopback workers bypass tenant hostname restrictions',async()=>{const original=process.env.GROOMPRO_SCHEDULER_TOKEN;process.env.GROOMPRO_SCHEDULER_TOKEN='test-worker-secret';try{const run=fixture('tenant');assert.equal((await run('/api/internal/scheduled-reports',false,'127.0.0.1:3000',{method:'POST',headers:{'x-groompro-scheduler':'test-worker-secret'}})).status,200);assert.equal((await run('/api/internal/scheduled-reports',false,'127.0.0.1:3000',{method:'POST',headers:{'x-groompro-scheduler':'wrong'}})).status,404);assert.equal((await fixture('staging')('/api/internal/scheduled-reports',false,'127.0.0.1:3000',{method:'POST',headers:{'x-groompro-scheduler':'test-worker-secret'}})).status,404);}finally{if(original===undefined)delete process.env.GROOMPRO_SCHEDULER_TOKEN;else process.env.GROOMPRO_SCHEDULER_TOKEN=original;}});
