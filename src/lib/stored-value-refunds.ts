import {readStoredValuePolicy} from './stored-value-policy';
import {isGiftCardLine,giftCardSource} from './gift-card-line';
import {isPrepaidPurchaseLine,remainingPrepaidValues} from './prepaid-lines';
export async function prepareStoredValueRefunds(tx:any,tenantId:string,ticket:any,lock=false,items:any[]=[]){
 const records=new Map<string,any>();if(!ticket.lines.some((l:any)=>isGiftCardLine(l)||isPrepaidPurchaseLine(l)))return records;const policy=await readStoredValuePolicy(tx,tenantId);
 const purchases=ticket.lines.some(isPrepaidPurchaseLine)?(await tx.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:'PREPAID_PURCHASE:'}},select:{value:true}})).map((r:any)=>r.value).filter((p:any)=>p.saleTicketId===ticket.id):[];
 const owners=purchases.length?await tx.customer.findMany({where:{tenantId,id:{in:[...new Set(purchases.map((p:any)=>p.customerId))]}},select:{id:true,firstName:true,lastName:true}}):[];
 for(const line of [...ticket.lines].sort((a:any,b:any)=>a.id.localeCompare(b.id))){const gift=isGiftCardLine(line),prepaid=isPrepaidPurchaseLine(line);if(!gift&&!prepaid)continue;
 const choices=purchases.filter((p:any)=>p.lineId===line.id&&p.state==='ACTIVE'&&owners.some((c:any)=>c.id===p.customerId)).map((p:any)=>{const values=remainingPrepaidValues(p),owner=owners.find((c:any)=>c.id===p.customerId);return {purchaseId:p.id,customerId:p.customerId,customerName:owner.firstName+' '+owner.lastName,visitValuesCents:values,balanceCents:values.reduce((n,v)=>n+v,0)}});
 const selected=items.find(i=>i.lineId===line.id)?.purchaseId,id=gift?line.sourceKey.slice(giftCardSource.length):selected||line.sourceKey.split(':')[1],key=(gift?'GIFT_CARD:':'PREPAID_PURCHASE:')+id;
 if(prepaid&&selected&&!choices.some((c:any)=>c.purchaseId===selected))throw Error('This prepaid package is no longer available to this shop.');
 if(lock)await tx.$queryRaw`SELECT id FROM TenantSetting WHERE tenantId=${tenantId} AND settingKey=${key} FOR UPDATE`;
 const record=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:key}}}))?.value;
 if(!record||record.saleTicketId!==ticket.id||record.lineId!==line.id||record.state!=='ACTIVE')continue;
 if(prepaid&&!owners.some((c:any)=>c.id===record.customerId))throw Error('The family holding these prepaid visits is not available to this shop.');
 const allowed=gift?policy.giftCardsRefundable:policy.prepaidRefundable,values=prepaid?remainingPrepaidValues(record):null;
 line.storedRefund={kind:gift?'GIFT_CARD':'PREPAID',allowed:allowed===true,balanceCents:gift?record.balanceCents:values!.reduce((n,v)=>n+v,0),visitValuesCents:values,purchaseId:prepaid?record.id:null,customerId:record.customerId,choices};records.set(line.id,{key,record,values});
 }
 return records;
}
export async function removeRefundedStoredValue(tx:any,tenantId:string,ticket:any,items:any[],records:Map<string,any>,refundId:string,at:string){
 for(const item of items){const saved=records.get(item.lineId);if(!saved)continue;const {key,record}=saved,line=ticket.lines.find((l:any)=>l.id===item.lineId),gift=line.storedRefund.kind==='GIFT_CARD';
 if(gift)record.balanceCents-=item.amountCents;else{record.visitValuesCents=saved.values.slice(item.refundVisits);record.visitsRemaining=record.visitValuesCents.length;}
 record.entries.push({id:'refund:'+refundId,kind:'REFUND',ticketId:ticket.id,locationId:ticket.locationId,amountCents:item.amountCents,...(gift?{}:{visits:item.refundVisits}),at});
 await tx.tenantSetting.update({where:{tenantId_settingKey:{tenantId,settingKey:key}},data:{value:record}});
 }
}
