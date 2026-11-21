import {assessAccountFee} from './account-fee';
import {noShowOperationKey} from './no-show-operation';
// Complete account-funded fees in one transaction. A saved card is not charged
// when existing Customer Credit covers the fee. Partial credit with a saved
// card proceeds to the separate card reservation and remainder charge.
export async function settleNoShowFromAccount(client:any,tenantId:string,actorUserId:string,ticketId:string,feeCents:number,requireFullCredit:boolean){
 return client.$transaction(async(tx:any)=>{
  await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticketId} AND tenantId=${tenantId} FOR UPDATE`;
  const ticket=await tx.ticket.findFirst({where:{id:ticketId,tenantId}});if(!ticket)throw Error('Ticket could not be found.');
  if(ticket.noShowFeeProcessedAt)return {success:true,repeated:true};
  if(['CLOSED','CANCELLED'].includes(ticket.status))throw Error('This ticket is closed, cancelled or voided and cannot receive a no-show fee.');
  const settingKey=noShowOperationKey(ticketId),where={tenantId_settingKey:{tenantId,settingKey}},operation=(await tx.tenantSetting.findUnique({where}))?.value;
  if(operation?.state==='RUNNING')throw Error('A no-show fee is processing or needs verification. Review payment and account history before trying again.');
  const customers=await tx.$queryRaw`SELECT creditCents FROM Customer WHERE id=${ticket.customerId} AND tenantId=${tenantId} FOR UPDATE`;
  if(!customers.length)throw Error('Customer account could not be found.');
  const credit=Number(customers[0].creditCents||0);if(!Number.isSafeInteger(credit)||credit<0)throw Error('Review the customer’s credit before assessing this fee.');
  if(requireFullCredit&&credit<feeCents)return null;
  const settlement=await assessAccountFee(tx,{tenantId,actorUserId,customerId:ticket.customerId,ticketId,feeCents,reason:'No-Show Fee for Ticket #'+ticket.orderNumber,referenceId:settingKey});
  await tx.$executeRaw`UPDATE Ticket SET noShowFeeCents=${feeCents},noShowFeeProcessedAt=CURRENT_TIMESTAMP(3),status='CANCELLED',closedAt=CURRENT_TIMESTAMP(3) WHERE id=${ticketId} AND tenantId=${tenantId}`;
  const value={state:'DONE',completedAt:new Date().toISOString(),...settlement};await tx.tenantSetting.upsert({where,create:{tenantId,settingKey,value},update:{value}});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId,entityType:'TICKET',entityId:ticketId,customerId:ticket.customerId,action:'NO_SHOW_FEE_TO_ACCOUNT',summary:'Applied $'+(settlement.creditUsedCents/100).toFixed(2)+' Customer Credit toward the no-show fee; $'+(settlement.owedCents/100).toFixed(2)+' added to Balance Owed.',details:{feeCents,...settlement,noShowStatus:'NO_SHOW'}}});
  return {success:true,repeated:false,method:!settlement.owedCents?'CUSTOMER_CREDIT':'ACCOUNT_BALANCE',feeCents,closed:true,...settlement,message:settlement.owedCents?'Customer Credit covered $'+(settlement.creditUsedCents/100).toFixed(2)+'. The remaining $'+(settlement.owedCents/100).toFixed(2)+' will be included on the next grooming ticket.':'Customer Credit covered the no-show fee. No additional amount is owed for this fee.'};
 });
}
