const test=require('node:test'),assert=require('node:assert/strict');
require('./load-ts.cjs');
const {transferPet}=require('../src/lib/pet-transfer.ts');
function fixture(){
 const state={pet:{id:'dog',tenantId:'shop',customerId:'john',name:'Gizmo'},tickets:[{petId:'dog',customerId:'john',paidCents:5000}],notes:[{petId:'dog',customerId:'john',body:'Leave tail long'}],audits:[]};
 const tx={tenantSetting:{findMany:async()=>[]},$queryRaw:async()=>[],pet:{findFirst:async({where})=>where.tenantId===state.pet.tenantId&&where.id===state.pet.id&&(!where.customerId||where.customerId===state.pet.customerId)?{...state.pet}:null,updateMany:async({where,data})=>{if(where.customerId!==state.pet.customerId)return{count:0};Object.assign(state.pet,data);return{count:1}}},customer:{findFirst:async({where})=>where.tenantId==='shop'&&['john','maria','sue'].includes(where.id)?{id:where.id,firstName:where.id,lastName:'Family'}:null},auditEntry:{create:async({data})=>state.audits.push(data)}};
 return {state,tx};
}
test('repeated transfers retain pet identity, all tickets, notes and the original charged customer',async()=>{
 const {state,tx}=fixture(),tickets=structuredClone(state.tickets),notes=structuredClone(state.notes);
 for(let i=0;i<30;i++){const old=state.pet.customerId,next=old==='maria'?'sue':'maria';const pet=await transferPet(tx,'shop','staff',{petId:'dog',customerId:old,newCustomerId:next});assert.equal(pet.id,'dog');assert.equal(pet.customerId,next);}
 assert.equal(state.audits.length,30);assert.deepEqual(state.tickets,tickets);assert.deepEqual(state.notes,notes);assert.equal(state.audits[0].details.previousCustomerId,'john');
});
test('stale owner, wrong tenant, inaccessible destination and same family cannot transfer',async()=>{
 for(const input of [{customerId:'old',newCustomerId:'maria'},{customerId:'john',newCustomerId:'foreign'},{customerId:'john',newCustomerId:'john'}]){const {state,tx}=fixture();await assert.rejects(()=>transferPet(tx,'shop','staff',{petId:'dog',...input}));assert.equal(state.pet.customerId,'john');assert.equal(state.audits.length,0);}
 const {state,tx}=fixture();await assert.rejects(()=>transferPet(tx,'other','staff',{petId:'dog',customerId:'john',newCustomerId:'maria'}));assert.equal(state.pet.customerId,'john');
});
