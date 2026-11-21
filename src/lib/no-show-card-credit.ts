import {randomUUID} from 'node:crypto';
import {noShowOperationKey} from './no-show-operation';
export async function reserveNoShowCardCredit(client:any,tenantId:string,ticketId:string,actorUserId:string,feeCents:number){return client.$transaction(async(tx:any)=>{
 await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticketId} AND tenantId=${tenantId} FOR UPDATE`;
 const ticket=await tx.ticket.findFirst({where:{id:ticketId,tenantId}});if(!ticket)throw Error('Ticket could not be found.');if(ticket.noShowFeeProcessedAt)return null;if(['CLOSED','CANCELLED'].includes(ticket.status))throw Error('This ticket can no longer receive a no-show fee.');
 const settingKey=noShowOperationKey(ticketId),where={tenantId_settingKey:{tenantId,settingKey}},old=(await tx.tenantSetting.findUnique({where}))?.value;if(old?.state==='RUNNING')throw Error('A no-show charge needs verification. Review its payment history before trying again.');
 const customers=await tx.$queryRaw`SELECT creditCents FROM Customer WHERE id=${ticket.customerId} AND tenantId=${tenantId} FOR UPDATE`;
 const credit=Number(customers[0]?.creditCents);if(!customers.length||!Number.isSafeInteger(credit)||credit<0||!Number.isSafeInteger(feeCents)||feeCents<0)throw Error('Review this customer’s credit and the no-show fee before continuing.');
 const creditUsedCents=Math.min(credit,feeCents),value={state:'RUNNING',operationId:randomUUID(),startedAt:new Date().toISOString(),customerId:ticket.customerId,creditUsedCents,chargeCents:feeCents-creditUsedCents,feeCents};
 if(creditUsedCents){const id=randomUUID(),reason='Customer Credit reserved for the no-show fee on Ticket #'+ticket.orderNumber;await tx.$executeRaw`INSERT INTO CustomerAccountLedger (id,tenantId,customerId,ticketId,actorUserId,entryType,amountCents,reason,referenceId) VALUES (${id},${tenantId},${ticket.customerId},${ticketId},${actorUserId},'CREDIT',${-creditUsedCents},${reason},${value.operationId})`;await tx.$executeRaw`UPDATE Customer SET creditCents=creditCents-${creditUsedCents} WHERE id=${ticket.customerId} AND tenantId=${tenantId}`;}
 await tx.tenantSetting.upsert({where,create:{tenantId,settingKey,value},update:{value}});return value;
});}
// Release only after a definite rejection. An unknown provider result keeps its
// reservation so a retry cannot charge twice or spend the same credit elsewhere.
export async function releaseNoShowCardCredit(client:any,tenantId:string,ticketId:string,actorUserId:string,operationId:string){return client.$transaction(async(tx:any)=>{
 await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticketId} AND tenantId=${tenantId} FOR UPDATE`;
 const where={tenantId_settingKey:{tenantId,settingKey:noShowOperationKey(ticketId)}},saved=(await tx.tenantSetting.findUnique({where}))?.value;if(!saved||saved.operationId!==operationId)throw Error('This fee request changed. Review payment history.');if(saved.state==='FAILED')return;if(saved.state!=='RUNNING')throw Error('This fee request has already completed.');
 if(saved.creditUsedCents){await tx.$queryRaw`SELECT id FROM Customer WHERE id=${saved.customerId} AND tenantId=${tenantId} FOR UPDATE`;const id=randomUUID(),reason='Returned Customer Credit after the no-show card charge was declined.';await tx.$executeRaw`INSERT INTO CustomerAccountLedger (id,tenantId,customerId,ticketId,actorUserId,entryType,amountCents,reason,referenceId) VALUES (${id},${tenantId},${saved.customerId},${ticketId},${actorUserId},'CREDIT',${saved.creditUsedCents},${reason},${operationId})`;await tx.$executeRaw`UPDATE Customer SET creditCents=creditCents+${saved.creditUsedCents} WHERE id=${saved.customerId} AND tenantId=${tenantId}`;}
 await tx.tenantSetting.update({where,data:{value:{...saved,state:'FAILED',completedAt:new Date().toISOString()}}});
});}
