const test=require('node:test'),assert=require('node:assert/strict');
const {siteRole,allowsHost,validateDeployment,validateDatabase,runsSchedulers}=require('../scripts/site-deployment.cjs');
test('existing installation retains its addresses, database and background sending',()=>{
 assert.equal(siteRole({}),'current');assert.equal(allowsHost('existing.preview.airoapp.ai',{}),true);assert.equal(runsSchedulers({}),true);assert.doesNotThrow(()=>validateDatabase('mysql://staff:secret@db/live',{}));
});
test('separate sites fail closed for unknown roles, hosts and conflicting business routing',()=>{
 assert.throws(()=>siteRole({GROOMPRO_SITE_ROLE:'stagin'}));
 assert.throws(()=>validateDeployment({GROOMPRO_SITE_ROLE:'admin'}));
 const env={GROOMPRO_SITE_ROLE:'admin',GROOMPRO_SITE_HOSTS:'admin.example.com'};
 assert.equal(allowsHost('ADMIN.example.com:443',env),true);assert.equal(allowsHost('admin.example.com.evil.test',env),false);
 assert.throws(()=>validateDeployment({...env,GROOMPRO_SUBDOMAIN_ROUTING_ENABLED:'true'}));
});
test('development and staging cannot use the live database or each other’s database',()=>{
 for(const role of ['development','staging']){
  const env={GROOMPRO_SITE_ROLE:role,GROOMPRO_LIVE_DATABASE_NAME:'groompro_live'};
  for(const name of ['groompro_live','groompro','groompro_'+(role==='staging'?'development':'staging')])assert.throws(()=>validateDatabase('mysql://user:pass@db/'+name,env));
  assert.throws(()=>validateDatabase('mysql://user:pass@db/groompro_'+role,{GROOMPRO_SITE_ROLE:role}));
  assert.doesNotThrow(()=>validateDatabase('mysql://user:pass@db/groompro_'+role,env));
 }
});
test('sales has no database and only the working tenant site runs schedulers',()=>{
 assert.throws(()=>validateDeployment({GROOMPRO_SITE_ROLE:'sales',GROOMPRO_SITE_HOSTS:'www.example.com',DB_HOST:'live'}));
 assert.throws(()=>validateDatabase('mysql://user:pass@db/live',{GROOMPRO_SITE_ROLE:'sales'}));
 for(const role of ['sales','admin','development','staging'])assert.equal(runsSchedulers({GROOMPRO_SITE_ROLE:role}),false);
 assert.equal(runsSchedulers({GROOMPRO_SITE_ROLE:'tenant'}),true);
});
