const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, deps) {
  const exports = {};
  new Function('require', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name => {
    if (!(name in deps)) throw Error(name);
    return deps[name];
  }, exports);
  return exports;
}
function fixture() {
  const subscriptions = {a:{plan:'TOP',status:'active'},b:{plan:'BASIC',status:'active'}};
  const plans = {TOP:['REPORTS','SEVEN_STAGE_GROOMING'],BASIC:['REPORTS']};
  const overrides = {};
  const db = {
    tenantFeature:{findUnique:async({where:{tenantId_featureCode:k}})=>overrides[k.tenantId+':'+k.featureCode]||null},
    subscription:{findUnique:async({where})=>subscriptions[where.tenantId]||null},
    planFeature:{findUnique:async({where:{planCode_featureCode:k}})=>plans[k.planCode]?.includes(k.featureCode)?k:null,count:async({where})=>(plans[where.planCode]||[]).filter(c=>c!==where.featureCode.not).length},
    rolePermission:{findUnique:async({where:{tenantId_role_permissionCode:k}})=>({enabled:k.tenantId==='a'&&k.role==='MANAGER'})},
  };
  const roles={isPlatformRole:role=>['PLATFORM_OWNER','DEVELOPER'].includes(role)};
  const platform=load('src/lib/platform-access.ts',{'@/src/lib/roles':roles,'./employee-session':{},'./db':{db}});
  const access=load('src/lib/feature-access.ts',{'@/src/lib/roles':roles,'./platform-access':platform,'@/src/lib/db':{db}});
  return {access,subscriptions,overrides};
}
test('optional care workflow follows each tenant plan without leaking access between businesses',async()=>{
 const f=fixture();
 assert.equal(await f.access.isFeatureEnabled('a','SEVEN_STAGE_GROOMING'),true);
 assert.equal(await f.access.isFeatureEnabled('b','SEVEN_STAGE_GROOMING'),false);
 assert.equal(await f.access.isFeatureEnabled('b','REPORTS'),true);
 f.subscriptions.a.status='cancelled';
 assert.equal(await f.access.isFeatureEnabled('a','SEVEN_STAGE_GROOMING'),false);
});
test('developer grants and tenant disable controls preserve their existing scope',async()=>{
 const f=fixture();
 f.overrides['b:SEVEN_STAGE_GROOMING']={enabled:true,config:{platformOverride:true}};
 assert.equal(await f.access.isFeatureEnabled('b','SEVEN_STAGE_GROOMING'),true);
 assert.equal(await f.access.isFeatureEnabled('a','SEVEN_STAGE_GROOMING'),true);
 f.overrides['a:SEVEN_STAGE_GROOMING']={enabled:false};
 assert.equal(await f.access.isFeatureEnabled('a','SEVEN_STAGE_GROOMING'),false);
});
test('feature access does not give employees another tenant’s role permissions; platform roles retain access',async()=>{
 const f=fixture();
 assert.equal(await f.access.hasRolePermission('a','MANAGER','REPORTS'),true);
 assert.equal(await f.access.hasRolePermission('b','MANAGER','REPORTS'),false);
 assert.equal(await f.access.hasRolePermission('a','FRONT','REPORTS'),false);
 assert.equal(await f.access.hasRolePermission('b','PLATFORM_OWNER','REPORTS'),true);
 assert.equal(await f.access.hasRolePermission('b','DEVELOPER','REPORTS'),true);
});
