const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function fixture(){let access={portal:true,channel:'online',phone:'5555550100',locationId:'shop'},enabled=true,restricted=false,calls=[];
 const fail=message=>Object.assign(Error(message),{name:'AgreementError'});
 const db={tenantSetting:{findUnique:async()=>null},ticket:{findFirst:async({where})=>{calls.push(where);return null}},$queryRaw:async(strings,...values)=>{calls.push(values);return []},$transaction:async fn=>fn(db)};
 const dependencies={'@/src/lib/feature-access':{isFeatureEnabled:async()=>enabled},'@/src/lib/actions/ticket-booking':{},'@/src/lib/portal-availability':{},'@/src/lib/operating-hours':{},'@/src/lib/customer-agreement-pdf':{agreementRevision:()=> 'revision'},'next/server':{NextResponse:class extends Response{static json=Response.json}},'@/src/lib/db':{db},'@/src/lib/platform-restrictions':{platformRestriction:async()=>restricted},'@/src/lib/customer-agreement-store':{validTenant:t=>t==='tenant',isAgreementToken:t=>t==='valid',readAccess:async()=>access,requireAgreementLocation:async()=> 'shop',readableAgreement:s=>{if(s.proof)throw fail('Verify your phone number first.')},agreementProfile:async()=>({id:'own-customer',pets:[{id:'own-pet'}]}),updateAgreementProfile:async(...args)=>{calls.push(args);return {id:'own-customer'}},agreementPicturePath:()=> 'own-picture'},'@/src/lib/portal-policy-store':{},'@/src/lib/customer-account':{},'@/src/lib/cancellation-policy':{},'@/src/lib/portal-requests':{},'@/src/lib/customer-sharing-context':{},'@/src/lib/customer-agreement-signing':{parseAgreementPdf:()=>null}};
 const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../app/api/customer-portal/route.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(k=>dependencies[k],exports);
 return {post:b=>exports.POST({url:'https://test/api/customer-portal',text:async()=>JSON.stringify({tenant:'tenant',token:'valid',...b})}),setAccess:v=>access={...access,...v},disable:()=>enabled=false,restrict:()=>restricted=true,calls};
}
test('portal rejects missing proof, nonportal capabilities and restricted businesses',async()=>{
 let f=fixture();assert.equal((await f.post({token:'missing',action:'view'})).status,401);
 f=fixture();f.setAccess({portal:false});assert.equal((await f.post({action:'view'})).status,401);
 f=fixture();f.setAccess({proof:{}});assert.equal((await f.post({action:'photo',petId:'own-pet'})).status,400);
 f=fixture();f.restrict();assert.equal((await f.post({action:'view'})).status,404);
});
test('portal does not expose another customer pet, agreement or appointment',async()=>{
 const f=fixture();assert.equal((await f.post({action:'photo',petId:'someone-else'})).status,404);
 assert.equal((await f.post({action:'document',documentId:'someone-else'})).status,404);assert.deepEqual(f.calls[0],['tenant','own-customer','someone-else']);
 assert.equal((await f.post({action:'change',ticketId:'someone-else',reason:'New date please'})).status,400);assert.equal(f.calls.at(-1).customerId,'own-customer');assert.equal(f.calls.at(-1).tenantId,'tenant');
});
test('portal profile edits require the version the customer saw and booking respects enabled features',async()=>{
 const f=fixture();assert.equal((await f.post({action:'edit',fields:{firstName:'New'}})).status,409);
 assert.equal((await f.post({action:'edit',fields:{firstName:'New'},expectedRevision:'seen'})).status,200);assert.equal(f.calls[0][4],'seen');
 f.disable();assert.equal((await f.post({action:'book'})).status,403);
});
