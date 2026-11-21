import {ticketSettledCents} from './ticket-settlement';
import {randomUUID} from 'node:crypto';
import {db} from './db';
// Lock the ticket before using credit, matching payment/void lock order. A
// concurrent void must not leave credit deducted from a terminal ticket.
export async function applyTicketCredit(tenantId:string,actorUserId:string,ticketId:string,requested:number,client:any=db,operationId?:string){
 if(operationId&&!/^[a-f0-9-]{36}$/i.test(operationId))throw Error('Reopen this ticket before applying credit.');
 if(!ticketId||!Number.isSafeInteger(requested)||requested<=0)throw Error('Choose a ticket and a positive credit amount.');
 return client.$transaction(async(tx:any)=>{
  await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticketId} AND tenantId=${tenantId} FOR UPDATE`;
  const t=await tx.ticket.findFirst({where:{id:ticketId,tenantId},include:{lines:true,payments:true}});if(!t)throw Error('Ticket could not be found.');
  const key=operationId?'TICKET_CREDIT_USE:'+operationId:null,prior=key?(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:key}}}))?.value:null;if(prior){if(prior.ticketId!==ticketId||prior.requested!==requested)throw Error('This credit request was recorded with different details. Review the ticket before trying again.');return prior.result;}
  if(['CLOSED','CANCELLED','NO_SHOW'].includes(t.status))throw Error('Customer credit cannot be applied to a closed, cancelled or voided ticket.');
  const customers=await tx.$queryRaw`SELECT balanceCents,creditCents,loyaltyPoints FROM Customer WHERE id=${t.customerId} AND tenantId=${tenantId} FOR UPDATE`;
  if(!customers.length)throw Error('Customer could not be found.');const account=customers[0],total=t.lines.reduce((sum:number,l:any)=>sum+Math.max(0,l.unitPriceCents*l.quantity-l.discountCents),0)+Number(t.tipCents||0)+Number(t.salesTaxCents||0),due=Math.max(0,total-ticketSettledCents(t)),appliedCents=Math.min(requested,due,Math.max(0,Number(account.creditCents||0)));if(!due)throw Error('This ticket has no balance left to pay.');if(!appliedCents)throw Error('Customer has no available credit.');
  const id=randomUUID(),reason='Customer credit applied to Ticket #'+t.orderNumber+'.';
  await tx.$executeRaw`INSERT INTO CustomerAccountLedger (id,tenantId,customerId,ticketId,actorUserId,entryType,amountCents,reason) VALUES (${id},${tenantId},${t.customerId},${ticketId},${actorUserId},'CREDIT',${-appliedCents},${reason})`;
  await tx.$executeRaw`UPDATE Customer SET creditCents=creditCents-${appliedCents} WHERE id=${t.customerId} AND tenantId=${tenantId}`;
  await tx.$executeRaw`UPDATE Ticket SET accountCreditCents=accountCreditCents+${appliedCents} WHERE id=${ticketId} AND tenantId=${tenantId}`;
  const balanceLineCents=t.lines.filter((l:any)=>l.description==='Customer Account Balance').reduce((sum:number,l:any)=>sum+Math.max(0,l.unitPriceCents*l.quantity-l.discountCents),0),settledBalanceCents=Math.min(appliedCents,Math.max(0,Number(account.balanceCents||0)),balanceLineCents);
  if(settledBalanceCents){const settlementId=randomUUID(),settlementReason='Customer Credit paid the prior balance on Ticket #'+t.orderNumber+'.';await tx.$executeRaw`INSERT INTO CustomerAccountLedger (id,tenantId,customerId,ticketId,actorUserId,entryType,amountCents,reason) VALUES (${settlementId},${tenantId},${t.customerId},${ticketId},${actorUserId},'OWED',${-settledBalanceCents},${settlementReason})`;await tx.$executeRaw`UPDATE Customer SET balanceCents=balanceCents-${settledBalanceCents} WHERE id=${t.customerId} AND tenantId=${tenantId}`;}
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId,entityType:'TICKET',entityId:ticketId,customerId:t.customerId,action:'CUSTOMER_CREDIT_APPLIED',summary:'Applied $'+(appliedCents/100).toFixed(2)+' customer credit to ticket #'+t.orderNumber+'.',details:{appliedCents,settledBalanceCents,previousTicketCreditCents:Number(t.accountCreditCents||0)}}});
  const result={success:true,appliedCents,account:{...account,balanceCents:Number(account.balanceCents||0)-settledBalanceCents,creditCents:Number(account.creditCents)-appliedCents}};if(key)await tx.tenantSetting.create({data:{tenantId,settingKey:key,value:{ticketId,requested,result}}});return result;
 });
}
