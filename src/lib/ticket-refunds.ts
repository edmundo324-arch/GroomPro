import {readStoredValuePolicy} from './stored-value-policy';
import {prepareStoredValueRefunds,removeRefundedStoredValue} from './stored-value-refunds';
import {db} from './db';
import {addAccountEntry} from './customer-account';
import {refundRequest,refundAvailable,validateRefund,proportionalTipReversal} from './ticket-refund-rules';

export const ticketRefundPrefix=(ticketId:string)=>'TICKET_REFUND:'+ticketId+':';
export async function ticketRefundHistory(tx:any,tenantId:string,ticketId:string){
 const rows=await tx.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:ticketRefundPrefix(ticketId)}},select:{value:true}});
 return rows.map((row:any)=>{const value=row.value;if(!value||value.ticketId!==ticketId||!Number.isSafeInteger(value.totalCents)||value.totalCents<=0)throw Error('An earlier refund record needs review. Ask the business owner to check this ticket.');const normalized=refundRequest(value);if(normalized.items.reduce((sum,item)=>sum+item.amountCents,0)+normalized.taxCents+normalized.tipCents!==value.totalCents)throw Error('An earlier refund total needs review before another refund can be recorded.');return value;}).sort((a:any,b:any)=>String(a.recordedAt).localeCompare(String(b.recordedAt)));
}
export async function readTicketRefunds(tenantId:string,ticketId:string){const ticket=await db.ticket.findFirst({where:{tenantId,id:ticketId},include:{lines:{include:{service:true,product:true}},payments:true}});if(!ticket)throw Error('This ticket is unavailable. Reopen it from the customer’s history.');await prepareStoredValueRefunds(db,tenantId,ticket);const refunds=await ticketRefundHistory(db,tenantId,ticketId);const purchaser=await db.customer.findFirst({where:{tenantId,id:ticket.customerId},select:{id:true,firstName:true,lastName:true}});return {cashRefundsEnabled:(await readStoredValuePolicy(db,tenantId)).cashRefundsEnabled===true,ticketId,purchaser,orderNumber:ticket.orderNumber,status:ticket.status,refunds,...refundAvailable(ticket,refunds)};}

// The caller must supply the approved commission policy; it is never taken from customer input.
// This records a staff-reported cash return or account credit, not a provider transaction.
export async function recordTicketRefund(tenantId:string,actorUserId:string,ticketId:string,raw:any,commissionMode:'KEEP'|'REVERSE'){
 const input=refundRequest(raw),fingerprint=JSON.stringify(input);
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Ticket WHERE tenantId=${tenantId} AND id=${ticketId} FOR UPDATE`;
  const ticket=await tx.ticket.findFirst({where:{tenantId,id:ticketId},include:{lines:{include:{service:true,product:true}},payments:true}});if(!ticket)throw Error('This ticket is unavailable. Reopen it from the customer’s history.');
  const refunds=await ticketRefundHistory(tx,tenantId,ticketId),existing=refunds.find((r:any)=>r.id===input.id);
  if(existing){if(existing.fingerprint!==fingerprint)throw Error('This refund was already recorded with different details. Reopen the refund history before continuing.');return {refund:existing,repeated:true};}
  if(input.method==='CASH'&&(await readStoredValuePolicy(tx,tenantId)).cashRefundsEnabled!==true)throw Error('This business returns refunds as Customer Credit. An owner can enable cash refunds in the refund rules.');
  const storedValues=await prepareStoredValueRefunds(tx,tenantId,ticket,true,input.items);const {totalCents}=validateRefund(ticket,refunds,input),recordedAt=new Date().toISOString();
  const items=input.items.map(item=>{const line=ticket.lines.find(l=>l.id===item.lineId)!;
   // Record any approved reversal separately; never rewrite original service earnings.
   const previous=refunds.flatMap((r:any)=>r.items).filter((r:any)=>r.lineId===line.id&&r.commissionMode==='REVERSE'),oldAmount=previous.reduce((sum:number,r:any)=>sum+r.amountCents,0),oldCommission=previous.reduce((sum:number,r:any)=>sum+(r.commissionReversalCents||0),0);
   const commissionReversalCents=commissionMode==='REVERSE'&&line.totalCents>0?Math.max(0,Math.min(line.commissionCents,Math.round(line.commissionCents*(oldAmount+item.amountCents)/line.totalCents))-oldCommission):0;
   return {...item,description:line.description,productId:line.productId,assignedUserId:line.assignedUserId,commissionMode,commissionReversalCents};
  });
  await removeRefundedStoredValue(tx,tenantId,ticket,items,storedValues,input.id,recordedAt);
  const returns=new Map<string,number>();for(const item of items)if(item.returnQuantity&&item.productId)returns.set(item.productId,(returns.get(item.productId)||0)+item.returnQuantity);
  for(const productId of [...returns.keys()].sort()){
   const rows=await tx.$queryRaw<{id:string;name:string;quantity:number}[]>`SELECT id,name,quantity FROM Product WHERE tenantId=${tenantId} AND id=${productId} FOR UPDATE`,product=rows[0];
   if(!product)throw Error('A returned product no longer exists in Inventory. Remove its stock return and ask a manager to review it.');
   const quantity=returns.get(productId)!,after=product.quantity+quantity;if(!Number.isSafeInteger(after)||after>2147483647)throw Error('The resulting stock count is too large. Review this product in Inventory.');
   await tx.product.updateMany({where:{tenantId,id:productId},data:{quantity:after}});
   await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId,entityType:'INVENTORY_ITEM',entityId:productId,customerId:ticket.customerId,action:'REFUND_STOCK_RETURN',summary:`Returned ${quantity} ${product.name} to stock from ticket #${ticket.orderNumber}.`,details:{ticketId,refundId:input.id,quantity,before:product.quantity,after}}});
  }
  const tipKey='TICKET_TIPS:'+ticketId,tipWhere={tenantId_settingKey:{tenantId,settingKey:tipKey}},tipSaved=(await tx.tenantSetting.findUnique({where:tipWhere}))?.value as any;
  const tipReversals=proportionalTipReversal(input.tipCents,ticket.tipCents-refunds.reduce((sum:number,r:any)=>sum+r.tipCents,0),tipSaved?.shares||[]);
  if(input.tipCents){const allocation={revision:(tipSaved?.revision||0)+1,shares:(tipSaved?.shares||[]).map((s:any)=>({...s,amountCents:s.amountCents-(tipReversals.find(r=>r.userId===s.userId)?.amountCents||0)})).filter((s:any)=>s.amountCents>0)};await tx.tenantSetting.upsert({where:tipWhere,create:{tenantId,settingKey:tipKey,value:allocation},update:{value:allocation}});}
  const settingKey=ticketRefundPrefix(ticketId)+input.id,recipientCustomerId=input.recipientCustomerId||ticket.customerId;
  const recipient=await tx.customer.findFirst({where:{tenantId,id:recipientCustomerId},select:{id:true,firstName:true,lastName:true}});if(!recipient)throw Error('The refund recipient is no longer available to this shop.');
  if(input.method==='CREDIT')await addAccountEntry({tenantId,customerId:recipientCustomerId,ticketId,actorUserId,entryType:'CREDIT',amountCents:totalCents,referenceId:settingKey,reason:'Ticket refund: '+input.reason},tx);
  const refund={...input,items,tipReversals,totalCents,ticketId,recipientCustomerId,recipientName:[recipient.firstName,recipient.lastName].filter(Boolean).join(' '),customerId:ticket.customerId,locationId:ticket.locationId,orderNumber:ticket.orderNumber,originalClosedAt:ticket.closedAt?.toISOString()||null,actorUserId,recordedAt,fingerprint};
  await tx.tenantSetting.create({data:{tenantId,settingKey,value:refund}});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId,entityType:'TICKET',entityId:ticketId,customerId:ticket.customerId,action:'TICKET_REFUND',summary:`Recorded $${(totalCents/100).toFixed(2)} ${input.method==='CASH'?'cash refund':'refund as customer-account credit'} on ticket #${ticket.orderNumber}.`,details:{refundId:input.id,method:input.method,totalCents,recipientCustomerId,recipientName:refund.recipientName,reason:input.reason}}});
  return {refund,repeated:false};
 });
}
