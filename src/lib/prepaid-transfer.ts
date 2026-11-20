import {remainingPrepaidValues} from './prepaid-lines';
import {createHash} from 'node:crypto';
import {prepaidPurchaseKey,readPrepaidPurchase} from './prepaid-balances';
export const prepaidRevision=(p:any)=>createHash('sha256').update(JSON.stringify(p)).digest('hex');
export async function petPrepaidPackages(tx:any,tenantId:string,petId:string,customerId:string){
 const rows=await tx.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:'PREPAID_PURCHASE:'}}});
 return rows.map((r:any)=>r.value).filter((p:any)=>p.offer?.scope==='PET'&&p.petId===petId&&p.customerId===customerId&&(p.state==='PENDING'||p.state==='ACTIVE'&&p.visitsRemaining>0)).sort((a:any,b:any)=>a.id.localeCompare(b.id));
}
export async function transferPrepaidPackages(tx:any,tenantId:string,petId:string,customerId:string,newCustomerId:string,decisions:any[]=[]){
 const packages=await petPrepaidPackages(tx,tenantId,petId,customerId);
 if(!Array.isArray(decisions)||decisions.length!==packages.length||new Set(decisions.map(d=>d.purchaseId)).size!==decisions.length)throw Error('Choose what happens to each one-dog prepaid package before transferring this dog.');
 for(const original of packages){const p=await readPrepaidPurchase(tx,tenantId,original.id,true),choice=decisions.find(d=>d.purchaseId===original.id);
  if(!choice||choice.revision!==prepaidRevision(p)||!['FOLLOW','KEEP'].includes(choice.action))throw Error('A prepaid package changed. Reopen the transfer and review the remaining visits.');
  if(choice.action==='FOLLOW')p.customerId=newCustomerId;else p.petId=null;
  p.entries.push({id:crypto.randomUUID(),kind:choice.action==='FOLLOW'?'TRANSFER':'UNASSIGNED',at:new Date().toISOString(),previousCustomerId:customerId,customerId:p.customerId,petId:p.petId});
  await tx.tenantSetting.update({where:{tenantId_settingKey:{tenantId,settingKey:prepaidPurchaseKey(p.id)}},data:{value:p}});
 }
}
export async function assignPrepaidDog(tx:any,tenantId:string,customerId:string,purchaseId:string,petId:string,revision:string,actorUserId:string){
 const p=await readPrepaidPurchase(tx,tenantId,purchaseId,true);
 if(!p||p.customerId!==customerId||p.offer.scope!=='PET'||p.petId||!['ACTIVE','PENDING'].includes(p.state)||prepaidRevision(p)!==revision)throw Error('This prepaid package changed. Reopen its details before assigning a dog.');
 if(!await tx.pet.findFirst({where:{tenantId,id:petId,customerId,active:true}}))throw Error('Choose an active dog belonging to this family.');
 p.petId=petId;p.entries.push({id:crypto.randomUUID(),kind:'ASSIGNED',petId,at:new Date().toISOString()});
 await tx.tenantSetting.update({where:{tenantId_settingKey:{tenantId,settingKey:prepaidPurchaseKey(p.id)}},data:{value:p}});
 await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId,entityType:'PET',entityId:petId,customerId,action:'PREPAID_DOG_ASSIGNED',summary:'Assigned unused prepaid visits to this dog.',details:{purchaseId}}});
}

export async function giftPrepaidVisits(tx:any,tenantId:string,customerId:string,input:{purchaseId:string;recipientId:string;visits:number;revision:string;requestId:string},actorUserId:string){
 if(!/^[0-9a-f-]{36}$/i.test(input.requestId)||!Number.isSafeInteger(input.visits)||input.visits<1||input.recipientId===customerId)throw Error('Choose another family and a whole number of unused visits.');
 const recipient=await tx.customer.findFirst({where:{tenantId,id:input.recipientId,active:true},select:{id:true,firstName:true,lastName:true}});if(!recipient)throw Error('Choose an active customer profile available to this shop.');
 const p=await readPrepaidPurchase(tx,tenantId,input.purchaseId,true);if(!p||p.customerId!==customerId||p.state!=='ACTIVE')throw Error('Choose this family’s paid prepaid package.');
 const prior=p.entries.find((e:any)=>e.id===input.requestId);if(prior){if(prior.kind!=='GIFT_OUT'||prior.recipientId!==input.recipientId||prior.visits!==input.visits)throw Error('This transfer was already recorded with different details.');return {transferred:true,repeated:true,purchaseId:prior.newPurchaseId};}
 if(prepaidRevision(p)!==input.revision)throw Error('These prepaid visits changed. Reopen the package before transferring visits.');const values=remainingPrepaidValues(p);if(input.visits>values.length)throw Error('Only unused visits can be gifted.');
 const moved=values.splice(0,input.visits),at=new Date().toISOString(),value=moved.reduce((n,v)=>n+v,0),newPurchaseId=input.requestId;
 const gift={...p,id:newPurchaseId,customerId:recipient.id,petId:null,originPurchaseId:p.originPurchaseId||p.id,purchasedCustomerId:p.purchasedCustomerId||customerId,visitsRemaining:moved.length,visitValuesCents:moved,used:0,createdAt:at,entries:[{id:input.requestId,kind:'GIFT_IN',at,fromCustomerId:customerId,fromPurchaseId:p.id,visits:moved.length,amountCents:value}]};
 p.visitValuesCents=values;p.visitsRemaining=values.length;p.entries.push({id:input.requestId,kind:'GIFT_OUT',at,recipientId:recipient.id,newPurchaseId,visits:moved.length,amountCents:value});
 await tx.tenantSetting.create({data:{tenantId,settingKey:prepaidPurchaseKey(newPurchaseId),value:gift}});
 await tx.tenantSetting.update({where:{tenantId_settingKey:{tenantId,settingKey:prepaidPurchaseKey(p.id)}},data:{value:p}});
 await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId,entityType:'CUSTOMER',entityId:customerId,customerId,action:'PREPAID_VISITS_GIFTED',summary:'Gifted '+moved.length+' unused visits to '+recipient.firstName+' '+recipient.lastName+'.',details:{purchaseId:p.id,newPurchaseId,recipientId:recipient.id,visits:moved.length,amountCents:value}}});return {transferred:true,purchaseId:newPurchaseId};
}
