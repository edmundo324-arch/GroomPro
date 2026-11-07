const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
function load(file,deps={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(n in deps)return deps[n];throw Error(n)},Buffer,URL,URLSearchParams,Date,AbortSignal,...globals});return exports}
const signatures=load('src/lib/twilio-signature.ts',{'node:crypto':crypto});
test('provider signature binds tenant URL, full payload and secret; duplicate parameters are rejected',()=>{const url='https://app.example/api/integrations/twilio?tenantId=one',params=new URLSearchParams({Body:'Hello',From:'+15551234567'}),token='secret';const signature=crypto.createHmac('sha1',token).update(url+'BodyHelloFrom+15551234567').digest('base64');assert.equal(signatures.validTwilioSignature(url,params,token,signature),true);assert.equal(signatures.validTwilioSignature(url.replace('one','two'),params,token,signature),false);assert.equal(signatures.validTwilioSignature(url,params,'wrong',signature),false);params.append('Body','altered');assert.equal(signatures.validTwilioSignature(url,params,token,signature),false)});
test('delayed queued status never overwrites final delivery',()=>{assert.equal(signatures.deliveryCanAdvance('DELIVERED','QUEUED'),false);assert.equal(signatures.deliveryCanAdvance('SENT','DELIVERED'),true);assert.equal(signatures.deliveryCanAdvance('QUEUED','FAILED'),true)});
function fixture(config,fetcher,textingEnabled=true){let writes=[];const db={customer:{findFirst:async({where})=>where.tenantId==='tenant'?{phones:[{id:'phone',number:'5551234567'}]}:null},ticket:{findFirst:async()=>null},communication:{create:async({data})=>{const row={id:'msg',...data};writes.push(row);return row}}};const sms=load('src/lib/sms.ts',{'./db':{db},'./feature-access':{customerContactFeature:'CUSTOMER_TEXT_CALL',isFeatureEnabled:async()=>textingEnabled},'./customer':{normalizePhone:s=>s.replace(/\D/g,'')}},{process:{env:{GROOMPRO_SMS_TENANTS_JSON:JSON.stringify(config||{})}},fetch:fetcher||(()=>{throw Error('Must not contact provider')})});return {sms,writes}}
test('unconfigured messages are saved without a sent timestamp and never call the provider',async()=>{const f=fixture();const result=await f.sms.sendCustomerSms({tenantId:'tenant',customerId:'customer',phoneId:'phone',body:'Report card'});assert.equal(result.communication.deliveryStatus,'NOT_CONFIGURED');assert.equal(result.communication.sentAt,undefined);assert.match(result.message,/not sent/)});
test('another tenant, unrelated contact, or another customer ticket cannot receive a report card',async()=>{const f=fixture();for(const input of [{tenantId:'foreign'},{phoneId:'someone-else'},{ticketId:'foreign-ticket'}])await assert.rejects(f.sms.sendCustomerSms({tenantId:'tenant',customerId:'customer',phoneId:'phone',body:'Report card',...input}));assert.equal(f.writes.length,0)});

test('subscription denial stops SMS before any message is written or sent',async()=>{
 const f=fixture(undefined,undefined,false);
 await assert.rejects(f.sms.sendCustomerSms({tenantId:'tenant',customerId:'customer',body:'Test'}),f.sms.TextingPlanError);
 assert.equal(f.writes.length,0);
});
test('contact entitlement follows the active plan even when it has no included features',async()=>{
 let subscription=null, feature=null, included=false;
 const db={
  tenantFeature:{findUnique:async()=>feature},
  subscription:{findUnique:async()=>subscription},
  planFeature:{findUnique:async()=>included?{featureCode:'CUSTOMER_TEXT_CALL'}:null},
 };
 const access=load('src/lib/feature-access.ts',{'./db':{db},'@/src/lib/db':{db},'@/src/lib/roles':{},'./platform-access':{customerContactFeature:'CUSTOMER_TEXT_CALL'}});
 const enabled=()=>access.isFeatureEnabled('tenant',access.customerContactFeature);
 assert.equal(await enabled(),true);
 subscription={plan:'BASIC',status:'active'};
 assert.equal(await enabled(),false);
 feature={enabled:true,config:{platformOverride:true}};
 assert.equal(await enabled(),false);
 included=true;
 assert.equal(await enabled(),true);
 feature={enabled:false};
 assert.equal(await enabled(),false);
 feature=null;
 subscription.status='cancelled';
 assert.equal(await enabled(),false);
});
