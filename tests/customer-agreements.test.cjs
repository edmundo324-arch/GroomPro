const test=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
require('./load-ts.cjs');
const {quotePrice,verifiedSignature}=require('../src/lib/customer-agreement-model.ts');
const {agreementRevision,renderAgreementPdf}=require('../src/lib/customer-agreement-pdf.ts');
const terms={version:'1',clauses:[{title:'Membership terms',text:'Review policy before signing.',initialsRequired:false},{title:'Payment authorization',text:'Agree to the selected dog and recurring price.'}]};
const profile={id:'customer-a',firstName:'Avery',lastName:'Lee',email:'avery@example.com',phone:'5551231234',pets:[{id:'dog-a',name:'Charlie',breed:'Poodle'},{id:'dog-b',name:'Scout',breed:'Pug'}]};
const signature={name:'Avery Lee',adopted:true,acknowledged:[0,1],initials:{1:[[[0.1,0.2],[0.3,0.7]]]}};
const quote=[{petId:'dog-a',priceCents:4995},{petId:'dog-b',priceCents:5995}];
test('the signer must review every section and handwrite the required initials',()=>{
 assert.equal(quotePrice('49.95'),4995);
 assert.throws(()=>quotePrice('49.995'),/dollars and cents/);
 assert.deepEqual(verifiedSignature(signature,terms.clauses),signature);
 assert.throws(()=>verifiedSignature({...signature,initials:{}},terms.clauses),/Initial every/);
 assert.throws(()=>verifiedSignature({...signature,acknowledged:[0,0]},terms.clauses),/acknowledge/);
 assert.throws(()=>verifiedSignature({...signature,initials:{1:[[[0.1,0.2],[1.2,0.7]]]}},terms.clauses),/Invalid initials/);
 assert.notEqual(agreementRevision(profile,terms,quote),agreementRevision({...profile,firstName:'Ada'},terms,quote));
});
test('VIP agreement uses the live profile, selected dog, staff price and an idempotent signed document',async()=>{
 let saved=null,emails=0,marked=null,audit=0;
 const tenantId='tenant-a',token='fake-token';
 const state={kind:'vip',channel:'link',customerId:profile.id,terms,quote,shopEmail:'shop@example.com'};
 const tx={
  tenant:{findUniqueOrThrow:async()=>({name:'Demo salon'})},
  auditEntry:{create:async()=>{audit++;}},
  $executeRaw:async(strings,...args)=>{assert.match(strings[0],/INSERT INTO SignedDocument/);assert.equal(args[1],tenantId);saved={documentContent:args[10],customerEmail:args[9],sentCopy:false};},
  $queryRaw:async()=>[saved],
 };
 const db={$transaction:async(fn)=>fn(tx),$executeRaw:async()=>{saved.sentCopy=true;}};
 const store={
  agreementError:message=>Error(message),
  agreementProfile:async()=>structuredClone(profile),
  allowedAgreementEmail:()=>true,
  markAgreementSigned:async(_tx,_tenant,_token,_state,id)=>{marked=id;},
  readableAgreement:()=>{},
  readAccess:async(_tx,tenant)=>{assert.equal(tenant,tenantId);return {...state,documentId:marked};},
 };
 const load=Module._load;
 Module._load=function(id,parent,...args){
  if(parent?.filename.endsWith('customer-agreement-signing.ts')){
   if(id==='./db')return {db};
   if(id==='./customer-agreement-store')return store;
  }
  return load.call(this,id,parent,...args);
 };
 let signAgreement;
 try{({signAgreement}=require('../src/lib/customer-agreement-signing.ts'));}finally{Module._load=load;}
 const original=global.fetch,prev=process.env.GROOMPRO_AGREEMENT_EMAIL_TENANTS_JSON;
 process.env.GROOMPRO_AGREEMENT_EMAIL_TENANTS_JSON=JSON.stringify({[tenantId]:{apiKey:'test',from:'test@example.com'}});
 global.fetch=async(_url,options)=>{const data=JSON.parse(options.body);assert.equal(data.to.length,1);assert.ok(data.attachments[0].content);emails++;return {ok:true};};
 try{
  await assert.rejects(signAgreement(tenantId,token,{revision:'stale',signature,selectedPets:['dog-a']}),/profile changed/);
  await assert.rejects(signAgreement(tenantId,token,{revision:agreementRevision(profile,terms,quote),signature,selectedPets:['foreign']}),/Choose the dogs/);
  assert.equal(saved,null);
  const result=await signAgreement(tenantId,token,{revision:agreementRevision(profile,terms,quote),signature,selectedPets:['dog-a']});
  assert.equal(result.emailed,true);assert.equal(emails,2);assert.equal(audit,1);
  const pdf=Buffer.from(result.pdf,'base64').toString('latin1');
  assert.match(pdf,/Dog: Charlie/);assert.match(pdf,/\$49\.95/);assert.doesNotMatch(pdf,/Scout|59\.95/);
  assert.match(pdf,/Avery Lee/);
  assert.equal((await signAgreement(tenantId,token,{})).id,result.id);
  assert.equal(emails,2);assert.equal(audit,1);
 }finally{global.fetch=original;if(prev===undefined)delete process.env.GROOMPRO_AGREEMENT_EMAIL_TENANTS_JSON;else process.env.GROOMPRO_AGREEMENT_EMAIL_TENANTS_JSON=prev;}
});
test('the intake PDF is a valid-looking multi-page snapshot with the live name and initial strokes',()=>{
 const intakeTerms={...terms,clauses:Array.from({length:11},(_,i)=>({title:'Policy '+i,text:'Policy text for the customer. '.repeat(24)}))};
 const intakeSignature={...signature,initials:Object.fromEntries(intakeTerms.clauses.map((_,i)=>[i,signature.initials[1]]))};
 const pdf=renderAgreementPdf({business:'Demo salon',kind:'intake',profile,terms:intakeTerms,quote:[],signature:intakeSignature,signedAt:'2026-11-10T12:00:00Z'}).toString('latin1');
 assert.match(pdf,/^%PDF-1\.4/);assert.match(pdf,/New Customer Intake/);assert.match(pdf,/Dog: Scout/);assert.match(pdf,/\/Count [2-9]/);
 assert.match(pdf,/58\.60 \d+\.\d+ m 85\.80 \d+\.\d+ l S/);
 const offset=Number(pdf.match(/startxref\n(\d+)/)[1]);assert.equal(pdf.slice(offset,offset+4),'xref');
});

test('a verified form edits the scoped profile in place and an unverified form cannot edit it',async()=>{
 let access={customerId:profile.id,kind:'intake',expires:Date.now()+60000,terms,quote:[],shopEmail:'shop@example.com'};
 const row={...profile,phones:[{number:profile.phone}],pets:[]};
 let changes=0;
 const tx={
  $queryRaw:async()=>[],
  tenantSetting:{findUnique:async q=>{
   assert.equal(q.where.tenantId_settingKey.tenantId,'tenant-a');
   return q.where.tenantId_settingKey.settingKey.startsWith('CUSTOMER_AGREEMENT:')?{value:access}:null;
  }},
  customer:{updateMany:async q=>{
   assert.equal(q.where.tenantId,'tenant-a');assert.equal(q.where.id,profile.id);
   if(q.data.firstName){row.firstName=q.data.firstName;changes++;}
   return {count:1};
  },findFirst:async q=>{assert.equal(q.where.tenantId,'tenant-a');return row;}},
 };
 const db={$transaction:async fn=>fn(tx)};
 const load=Module._load;
 Module._load=function(id,parent,...args){
  if(parent?.filename.endsWith('customer-agreement-store.ts')){
   if(id==='./db')return {db};
   if(id==='./sms'||id==='./breed-store'||id==='./breed-classification')return {};
   if(id==='./customer-referrals')return {customerReferrals:async()=>new Map()};
  }
  return load.call(this,id,parent,...args);
 };
 let updateAgreementProfile;
 try{({updateAgreementProfile}=require('../src/lib/customer-agreement-store.ts'));}finally{Module._load=load;}
 access={...access,proof:'pending'};
 await assert.rejects(updateAgreementProfile('tenant-a','test',{firstName:'Ava'}),/Verify your phone/);
 delete access.proof;
 const updated=await updateAgreementProfile('tenant-a','test',{firstName:'Ava',balanceCents:10000});
 assert.equal(updated.id,profile.id);assert.equal(updated.firstName,'Ava');assert.equal(changes,1);
 access={...access,documentId:'signed'};
 await assert.rejects(updateAgreementProfile('tenant-a','test',{firstName:'Else'}),/already signed/);
 assert.equal(changes,1);
});
