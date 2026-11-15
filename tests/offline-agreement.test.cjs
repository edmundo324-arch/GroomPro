const test=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
require('./load-ts.cjs');

test('a tablet submission survives a lost reply and resumes delivery without a second document',async()=>{
 const saved=new Map();
 const load=Module._load;
 Module._load=function(id,parent,...args){
  if(parent?.filename.endsWith('offline-agreement.ts')&&id==='./offline-device-store')return {
   deviceRead:async key=>structuredClone(saved.get(key)),
   deviceUpdate:async(key,update)=>{const value=update(structuredClone(saved.get(key)));saved.set(key,structuredClone(value));return value;},
  };
  return load.call(this,id,parent,...args);
 };
 let api;
 try{api=require('../src/lib/offline-agreement.ts');}finally{Module._load=load;}
 const terms={version:'1',clauses:[]};
 let draft={id:crypto.randomUUID(),token:'',phone:'5551234567',serverRevision:'',edits:[],
  view:{profile:{id:'',phone:'5551234567',pets:[]},terms,business:'Demo',kind:'intake',revision:'',quote:[]}};
 draft=api.projectAgreementEdit(draft,{firstName:'Robin',lastName:'Hall',email:'robin@example.com'});
 draft=api.projectAgreementEdit(draft,{petId:'',name:'Maple'});
 const pet=draft.view.profile.pets[0].id;
 draft=api.projectAgreementEdit(draft,{petId:pet,color:'Gold'});
 draft.submission={signature:{name:'Robin Hall',adopted:true,initials:{},acknowledged:[]},selectedPets:[]};
 await api.updateTabletQueue('shop',()=>[draft]);
 let last=-1,documentCount=0,attempts=0;
 const send=async(action,body,token)=>{
  if(action==='startTablet'){assert.equal(body.offlineId,draft.id);return {token:'server-token'};}
  assert.equal(token,'server-token');
  if(action==='view')return {terms,revision:String(last),signed:documentCount>0};
  if(action==='edit'){
   const index=body.offlineEditIndex;
   if(index>last){
    assert.equal(body.expectedRevision,String(last));
    last=index;
    if(index===1){assert.equal(body.fields.newPetId,pet);throw Error('connection lost after commit');}
   }
   return {terms,revision:String(last)};
  }
  if(action==='sign'){
   if(!documentCount){assert.equal(body.signature.name,'Robin Hall');documentCount++;}
   return {id:'signed-document',emailed:++attempts===2};
  }
 };
 await api.syncTabletAgreements('shop',send);
 assert.equal((await api.readTabletQueue('shop'))[0].token,'server-token');
 await api.syncTabletAgreements('shop',send);
 assert.equal((await api.readTabletQueue('shop'))[0].documentId,'signed-document');
 await api.syncTabletAgreements('shop',send);
 assert.equal(documentCount,1);
 assert.equal(last,2);
 assert.deepEqual(await api.readTabletQueue('shop'),[]);
});
