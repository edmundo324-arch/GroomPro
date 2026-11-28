import {createHash} from 'node:crypto';
import {db} from './db';
import {attendanceFor,attendanceKey} from './customer-attendance';
import {initializeAppointmentMessageSettings} from './appointment-message-store';
import {emailAddress} from './email-delivery';
import {attendanceReplyKey} from './attendance-replies';

export async function confirmationNotice(client:any,tenantId:string,ticketId:string){
 const ticket=await client.ticket.findFirst({where:{tenantId,id:ticketId},include:{customer:true}});
 if(!ticket)throw Error('This appointment is unavailable. Reopen it from the customer’s profile.');
 const row=await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:attendanceKey(ticketId)}}});
 const state=attendanceFor(row?.value,ticket.scheduledStart);
 let reason='';
 if(!ticket.customer?.active)reason='This customer is inactive.';
 else if(state.confirmedAt)reason='The customer has already confirmed this appointment.';
 else if(['CHECKED_IN','IN_PROGRESS','READY'].includes(ticket.status))reason='The dogs are already here for this visit.';
 else if(!['OPEN','CONFIRMED'].includes(ticket.status))reason='This appointment is no longer open for confirmation.';
 else if(['REQUESTED','PENDING','REJECTED'].includes(ticket.bookingDecision))reason='Accept the booking before asking the customer to confirm.';
 else if(!ticket.scheduledStart)reason='Schedule this appointment before requesting confirmation.';
 else if(+ticket.scheduledStart<=Date.now())reason='The scheduled appointment time has passed.';
 const bounced=ticket.customer.email?await client.communication.findFirst({where:{tenantId,customerId:ticket.customerId,channel:'EMAIL',direction:'OUTBOUND',deliveryStatus:'BOUNCED',toAddress:ticket.customer.email},orderBy:{createdAt:'desc'}}):null;
 return {customerId:ticket.customerId,scheduledStart:ticket.scheduledStart?.toISOString()||'',canRequest:!reason,reason,bouncedEmail:bounced?ticket.customer.email:null};
}

export async function queueConfirmationRequest(client:any,tenantId:string,userId:string,input:{ticketId:string;scheduledStart:string;operationId:string;emailOnly?:boolean;sourceCommunicationId?:string}){
 if(!input.operationId||input.operationId.length>191)throw Error('Reopen the reminder action before trying again.');
 const settings=await initializeAppointmentMessageSettings(tenantId,client);
 if(!settings.policy.enabled)throw Error('Appointment messages are turned off for this business.');
 if(!settings.policy.publicOrigin)throw Error('Your shop’s confirmation link is not configured. Ask an owner or manager to finish appointment message setup.');
 const channels=input.emailOnly?settings.policy.channels.filter((c:string)=>c==='EMAIL'):settings.policy.channels;
 if(!channels.length)throw Error('Email is not enabled in this business’s appointment message settings.');
 return client.$transaction(async(tx:any)=>{
  await tx.$queryRaw`SELECT id FROM Ticket WHERE tenantId=${tenantId} AND id=${input.ticketId} FOR UPDATE`;
  const ticket=await tx.ticket.findFirst({where:{tenantId,id:input.ticketId},include:{customer:true}});
  if(!ticket?.customer?.active||!ticket.scheduledStart||+ticket.scheduledStart<=Date.now()||!['OPEN','CONFIRMED'].includes(ticket.status)||['REQUESTED','PENDING','REJECTED'].includes(ticket.bookingDecision))throw Error('This appointment no longer needs a confirmation request.');
  if(ticket.scheduledStart.toISOString()!==input.scheduledStart)throw Error('The appointment time changed. Reopen the ticket before sending a reminder.');
  const key='CONFIRMATION_REQUEST:'+createHash('sha256').update(JSON.stringify([tenantId,input.ticketId,input.operationId])).digest('hex');
  const previous=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:key}}}))?.value;
  if(previous){if(previous.scheduledStart!==input.scheduledStart)throw Error('This reminder belongs to the earlier appointment time.');return previous;}
  const where={tenantId_settingKey:{tenantId,settingKey:attendanceKey(ticket.id)}},row=await tx.tenantSetting.findUnique({where}),current=attendanceFor(row?.value,ticket.scheduledStart);
  if(current.confirmedAt)throw Error('The customer has already confirmed this appointment. No new request is needed.');
  const cancellation=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'PORTAL_CANCELLATION:'+ticket.id}}}))?.value;
  if(cancellation?.state==='PENDING')throw Error('Review the customer’s cancellation request before sending another confirmation request.');
  const uncertain=await tx.communication.findFirst({where:{tenantId,customerId:ticket.customerId,ticketId:ticket.id,channel:{in:channels},direction:'OUTBOUND',deliveryStatus:{in:['UNKNOWN','SENDING']}}});
  if(uncertain)throw Error('A previous message’s delivery is uncertain. Review Communication History and the delivery service before sending another copy.');
  const requestAt=new Date(Math.max(Date.now(),Date.parse(current.newRequestAt||'')+1||0)).toISOString();
  const value={...current,revision:current.revision+1,requestsPausedForStart:null,newRequestAt:requestAt,newRequestChannels:channels};
  await tx.tenantSetting.upsert({where,create:{tenantId,settingKey:attendanceKey(ticket.id),value},update:{value}});
  const request={requestAt,scheduledStart:input.scheduledStart,channels,sourceCommunicationId:input.sourceCommunicationId||null};
  await tx.tenantSetting.create({data:{tenantId,settingKey:key,value:request}});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:userId,entityType:'TICKET',entityId:ticket.id,customerId:ticket.customerId,action:'CONFIRMATION_REQUESTED',summary:input.emailOnly?'Requested a new confirmation email after correcting a bounced address.':'Staff requested another appointment confirmation.',details:request}});
  return request;
 });
}

export async function retryCorrectedConfirmationEmails(tenantId:string,customerId:string,userId:string,oldEmail:string,newEmail:string,client:any=db){
 if(!oldEmail||!newEmail||emailAddress(oldEmail)===emailAddress(newEmail))return;
 const bounced=await client.communication.findMany({where:{tenantId,customerId,channel:'EMAIL',direction:'OUTBOUND',deliveryStatus:'BOUNCED',toAddress:oldEmail,ticketId:{not:null}},orderBy:{createdAt:'desc'}}),seen=new Set<string>();
 for(const message of bounced){if(seen.has(message.ticketId))continue;
  const context=(await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:attendanceReplyKey(message.id)}}}))?.value;
  if(context?.kind!=='CONFIRMATION'||context.customerId!==customerId||context.ticketId!==message.ticketId)continue;seen.add(message.ticketId);
  try{const request=await queueConfirmationRequest(client,tenantId,userId,{ticketId:message.ticketId,scheduledStart:context.scheduledStart,operationId:'corrected:'+message.id+':'+createHash('sha256').update(emailAddress(newEmail)).digest('hex'),emailOnly:true,sourceCommunicationId:message.id});
   const {runAppointmentMessages}=await import('./appointment-message-runner');await runAppointmentMessages(null,{tenantId,ticketId:message.ticketId,requestAt:request.requestAt});
  }catch(error){await client.auditEntry.create({data:{tenantId,customerId,actorType:'SYSTEM',entityType:'TICKET',entityId:message.ticketId,action:'CONFIRMATION_RETRY_REVIEW',summary:'Review confirmation delivery after the email address correction.',details:{sourceCommunicationId:message.id,message:(error as Error).message}}});}
 }
}
