import {randomUUID} from 'node:crypto';
import {addAccountEntry} from './customer-account';
// Called inside the caller's ticket transaction, so fee assessment and credit
// use either both succeed or both roll back.
export async function assessAccountFee(tx:any,p:{tenantId:string;customerId:string;ticketId:string;actorUserId:string;feeCents:number;reason:string;referenceId:string}){
 if(!Number.isSafeInteger(p.feeCents)||p.feeCents<0)throw Error('Review the cancellation fee amount.');if(!p.feeCents)return{creditUsedCents:0,owedCents:0};
 const rows=await tx.$queryRaw`SELECT creditCents FROM Customer WHERE id=${p.customerId} AND tenantId=${p.tenantId} FOR UPDATE`;
 if(!rows.length)throw Error('Customer account could not be found.');const credit=Number(rows[0].creditCents||0);if(!Number.isSafeInteger(credit)||credit<0)throw Error('Review the customer’s credit before assessing this fee.');
 const creditUsedCents=Math.min(credit,p.feeCents),owedCents=p.feeCents-creditUsedCents;
 await addAccountEntry({tenantId:p.tenantId,customerId:p.customerId,ticketId:p.ticketId,actorUserId:p.actorUserId,entryType:'OWED',amountCents:p.feeCents,reason:p.reason,referenceId:p.referenceId},tx);
 if(creditUsedCents){const creditId=randomUUID(),owedId=randomUUID(),reason='Customer Credit applied to '+p.reason;
  await tx.$executeRaw`INSERT INTO CustomerAccountLedger (id,tenantId,customerId,ticketId,actorUserId,entryType,amountCents,reason,referenceId) VALUES (${creditId},${p.tenantId},${p.customerId},${p.ticketId},${p.actorUserId},'CREDIT',${-creditUsedCents},${reason},${p.referenceId})`;
  await tx.$executeRaw`INSERT INTO CustomerAccountLedger (id,tenantId,customerId,ticketId,actorUserId,entryType,amountCents,reason,referenceId) VALUES (${owedId},${p.tenantId},${p.customerId},${p.ticketId},${p.actorUserId},'OWED',${-creditUsedCents},${reason},${p.referenceId})`;
  await tx.$executeRaw`UPDATE Customer SET creditCents=creditCents-${creditUsedCents},balanceCents=balanceCents-${creditUsedCents} WHERE id=${p.customerId} AND tenantId=${p.tenantId}`;
 }
 return {creditUsedCents,owedCents};
}
