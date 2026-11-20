import {remainingPrepaidValues} from './prepaid-lines';
import {db} from './db';
export function prepaidBalances(purchases:any[],locationId:string,start:Date,end:Date){
 let purchasedCents=0,usedCents=0,usedVisits=0,refundedCents=0,remainingCents=0,remainingVisits=0;
 const rows=[];
 for(const p of purchases){if(p.state!=='ACTIVE')continue;let usedValue=0;
  for(const e of p.entries||[]){if(e.kind==='VISIT')usedValue+=e.amountCents||0;const at=+new Date(e.at);if(e.locationId!==locationId||at<+start||at>=+end||!Number.isFinite(at))continue;
   if(e.kind==='REFUND')refundedCents+=e.amountCents||0;if(e.kind==='PURCHASE')purchasedCents+=e.amountCents||0;if(e.kind==='VISIT'){usedCents+=e.amountCents||0;usedVisits+=e.visits||0;}
  }
  const balance=Array.isArray(p.visitValuesCents)?remainingPrepaidValues(p).reduce((sum,value)=>sum+value,0):Math.max(0,p.offer.priceCents-usedValue);remainingCents+=balance;remainingVisits+=p.visitsRemaining;
  rows.push({id:p.id,name:p.offer.name,customerId:p.customerId,visitsRemaining:p.visitsRemaining,remainingCents:balance,expiresOn:p.expiresOn,awaitingDog:p.offer.scope==='PET'&&!p.petId});
 }
 return {purchasedCents,usedCents,usedVisits,refundedCents,remainingCents,remainingVisits,rows};
}
export async function prepaidReport(tenantId:string,locationId:string,start:Date,end:Date){const rows=await db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:'PREPAID_PURCHASE:'}},select:{value:true}});const purchases=rows.map(r=>r.value as any),ids=[...new Set<string>(purchases.map(p=>p.customerId).filter(Boolean))];const customers=ids.length?await db.customer.findMany({where:{tenantId,id:{in:ids}},select:{id:true}}):[];const allowed=new Set(customers.map(c=>c.id));return prepaidBalances(purchases.filter(p=>allowed.has(p.customerId)),locationId,start,end);}
