import {db} from './db';
import {GROOMPRO_ROLES,isPlatformRole} from './roles';
export const ticketVoidKey=(id:string)=>'TICKET_VOID:'+id;
export const ticketVoidPolicyKey='TICKET_VOID_POLICY';
export const voidRoleChoices=GROOMPRO_ROLES.filter(r=>!isPlatformRole(r));
export function voidRoles(input:any):string[]{if(!Array.isArray(input)||input.some(r=>!voidRoleChoices.includes(r)))throw Error('Choose the employee roles allowed to void unpaid tickets.');return [...new Set<string>(input)];}
export function mayVoid(role:string,roles:string[]){return isPlatformRole(role)||roles.includes(role);}
export function voidEligibility(ticket:any){if(!ticket)return 'This ticket is not available. Reopen it from the customer’s history.';if(['CLOSED','CANCELLED','NO_SHOW'].includes(ticket.status))return 'This ticket is already closed or cancelled. Its history will be retained.';if(ticket.payments?.length||Number(ticket.accountCreditCents)>0||ticket.noShowFeeProcessedAt)return 'This ticket has a payment, applied credit or processed fee. Review its payments or refund options instead of voiding it.';return null;}
export async function voidTicket(tenantId:string,actor:{id:string;role:string},ticketId:string,reason:unknown,client:any=db){
 if(typeof reason!=='string'||!reason.trim()||reason.trim().length>1000)throw Error('Explain why this unpaid ticket should be voided, using up to 1,000 characters.');
 return client.$transaction(async(tx:any)=>{
  await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticketId} AND tenantId=${tenantId} FOR UPDATE`;
  const ticket=await tx.ticket.findFirst({where:{tenantId,id:ticketId},include:{payments:true}});
  if(!ticket)throw Error('This ticket is not available. Reopen it from the customer’s history.');
  const policy=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:ticketVoidPolicyKey}}}))?.value;
  if(!mayVoid(actor.role,voidRoles(policy?.roles||[])))throw Error('Your role is not permitted to void tickets. An owner can choose permitted roles in Settings → Calendar & Workflow → Void ticket access.');
  const where={tenantId_settingKey:{tenantId,settingKey:ticketVoidKey(ticketId)}},previous=(await tx.tenantSetting.findUnique({where}))?.value;
  if(previous)return {voided:previous};
  const fee=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'NO_SHOW_OPERATION:'+ticketId}}}))?.value;if(fee?.state==='RUNNING')throw Error('A no-show fee is processing or needs verification. Review the payment history before voiding this ticket.');
  const problem=voidEligibility(ticket);if(problem)throw Error(problem);
  const voided={ticketId,orderNumber:ticket.orderNumber,locationId:ticket.locationId,customerId:ticket.customerId,previousStatus:ticket.status,recordedAt:new Date().toISOString(),actorId:actor.id,reason:reason.trim(),totalCents:ticket.totalCents};
  // Retain every line and history record. CANCELLED is the existing terminal
  // storage state; the separate marker distinguishes a void from a cancellation.
  await tx.ticket.update({where:{id:ticket.id},data:{status:'CANCELLED',displayStatus:'Voided'}});
  await tx.tenantSetting.create({data:{tenantId,settingKey:ticketVoidKey(ticketId),value:voided}});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:actor.id,entityType:'TICKET',entityId:ticketId,customerId:ticket.customerId,action:'TICKET_VOIDED',summary:'Voided unpaid ticket #'+ticket.orderNumber+'. History retained.',details:voided}});
  return {voided};
 });
}
