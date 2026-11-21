import {randomUUID} from 'node:crypto';
import {db} from './db';
import {readPortalPolicy} from './portal-policy-store';
import {cancellationTiming,cancellationWarning,movedCancellationFee} from './cancellation-policy';
import {assessAccountFee} from './account-fee';
const requestError=(message:string)=>Object.assign(new Error(message),{name:'PortalError'});
export const cancellationKey=(id:string)=>'PORTAL_CANCELLATION:'+id;
export type CancellationRequest={id:string;state:'PENDING'|'WAIVED'|'FEE_APPLIED'|'ON_TIME'|'KEPT';requestedAt:string;deadline:string;late:boolean;feeCents:number;warning:string;reason:string;resolvedAt?:string;resolvedBy?:string;scheduledStart:string;keptAppointment?:boolean;reviewedStart?:string;feeAppliedCents?:number;creditUsedCents?:number;owedCents?:number};
export async function requestCancellation(tenantId:string,customerId:string,ticketId:string,reason:string,acknowledged:boolean,expectedFeeCents?:number,expectedWarning?:string,previousCancellationId?:string){
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticketId} AND tenantId=${tenantId} AND customerId=${customerId} FOR UPDATE`;
  const ticket=await tx.ticket.findFirst({where:{id:ticketId,tenantId,customerId},include:{tenant:{select:{name:true}}}});
  if(!ticket)throw requestError('This appointment could not be found. Refresh your appointments.');
  const where={tenantId_settingKey:{tenantId,settingKey:cancellationKey(ticketId)}};
  const existing=await tx.tenantSetting.findUnique({where});
  const previous=existing?.value as unknown as CancellationRequest|undefined;
  if(previous&&(!previous.keptAppointment||previousCancellationId!==previous.id))return previous;
  if(!['OPEN','CONFIRMED'].includes(ticket.status)||ticket.checkedInAt||!ticket.scheduledStart)throw requestError('Ask the shop to review this appointment before cancelling.');
  const policy=await readPortalPolicy(tenantId,tx),timing=cancellationTiming(ticket.scheduledStart,new Date(),policy.notice);
  const feeRow=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'NO_SHOW_FEE_CENTS'}}});
  const feeCents=feeRow?Number(feeRow.value):4500;
  if(!Number.isSafeInteger(feeCents)||feeCents<0)throw requestError('Ask the shop to review its cancellation fee.');
  const warning=cancellationWarning(policy,ticket.tenant.name,feeCents);
  if(timing.late&&(expectedFeeCents!==feeCents||expectedWarning!==warning))throw requestError('The cancellation policy changed. Refresh your appointments and review the current warning before submitting.');
  if(timing.late&&!acknowledged)throw requestError(warning);
  const value:CancellationRequest={id:randomUUID(),state:timing.late?'PENDING':'ON_TIME',...timing,feeCents:timing.late?feeCents:0,warning,reason:reason.trim().slice(0,2000),scheduledStart:ticket.scheduledStart.toISOString()};
  if(existing)await tx.tenantSetting.update({where,data:{value}});else await tx.tenantSetting.create({data:{tenantId,settingKey:cancellationKey(ticketId),value}});
  if(!timing.late)await tx.ticket.update({where:{id:ticketId},data:{status:'CANCELLED',displayStatus:null}});
  await tx.auditEntry.create({data:{tenantId,actorType:'SYSTEM',entityType:'TICKET',entityId:ticketId,customerId,action:'CUSTOMER_CANCELLATION',summary:timing.late?'Customer requested late cancellation; booking retained for shop review.':'Customer cancelled with the required notice.',details:value}});
  return value;
 });
}
export async function reviewCancellation(tenantId:string,ticketId:string,actorUserId:string,waive:boolean,reason:string,options?:{keepAppointment?:boolean;expectedStart?:string}){
 if(!reason.trim())throw requestError('Enter the reason for this decision.');
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticketId} AND tenantId=${tenantId} FOR UPDATE`;
  const ticket=await tx.ticket.findFirst({where:{id:ticketId,tenantId},include:{location:{select:{timezone:true}}}});
  if(!ticket)throw requestError('This appointment could not be found.');
  const where={tenantId_settingKey:{tenantId,settingKey:cancellationKey(ticketId)}};
  const row=await tx.tenantSetting.findUnique({where}),request=row?.value as unknown as CancellationRequest;
  if(!request)throw requestError('This appointment has no cancellation request.');
  if(request.state!=='PENDING')return request;
  const feeOperation=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'NO_SHOW_OPERATION:'+ticketId}}}))?.value as any;
  if(feeOperation?.state==='RUNNING')throw requestError('A no-show fee is processing or needs verification. Review payment and account history before deciding this cancellation.');
  const currentStart=ticket.scheduledStart?.toISOString(),moved=currentStart!==request.scheduledStart,keep=options?.keepAppointment===true;
  if(!['OPEN','CONFIRMED'].includes(ticket.status)||ticket.checkedInAt||!currentStart)throw requestError('This appointment changed after the request. Review it before deciding.');
  if(moved!==keep||keep&&options?.expectedStart!==currentStart)throw requestError('This appointment changed after the request. Refresh requests and review its current date before deciding.');
  const applicableFee=keep?movedCancellationFee(request.scheduledStart,currentStart,ticket.location.timezone,request.late,request.feeCents):request.feeCents;
  const feeAppliedCents=waive?0:applicableFee;
  const settlement=await assessAccountFee(tx,{tenantId,customerId:ticket.customerId,ticketId,actorUserId,feeCents:feeAppliedCents,reason:`Reserved Appointment Fee for Ticket #${ticket.orderNumber}`,referenceId:'PORTAL_CANCELLATION:'+request.id});
  const value:CancellationRequest={...request,state:waive?'WAIVED':keep&&!feeAppliedCents?'KEPT':'FEE_APPLIED',resolvedAt:new Date().toISOString(),resolvedBy:actorUserId,keptAppointment:keep,reviewedStart:currentStart,feeAppliedCents,...settlement};
  await tx.tenantSetting.update({where,data:{value}});
  if(!keep)await tx.ticket.update({where:{id:ticketId},data:{status:'CANCELLED',displayStatus:null}});
  const summary=settlement.creditUsedCents?'Applied $'+(settlement.creditUsedCents/100).toFixed(2)+' Customer Credit to the fee; $'+(settlement.owedCents/100).toFixed(2)+' remains owed.':keep?(feeAppliedCents?'Kept the moved appointment and added its late-change fee to the customer account.':waive?'Kept the moved appointment and waived the fee.':'Kept the moved appointment without a fee under the cancellation rule.'):waive?'Approved cancellation and waived the fee.':'Approved cancellation and added the fee to the customer account.';
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId,entityType:'TICKET',entityId:ticketId,customerId:ticket.customerId,action:'CANCELLATION_REVIEW',summary,details:{...value,reviewReason:reason.trim().slice(0,2000)}}});
  return value;
 });
}
