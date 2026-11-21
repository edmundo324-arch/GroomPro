import {attendanceFor,attendanceKey} from './customer-attendance';
export const attendanceReplyKey=(id:string)=>'APPOINTMENT_REPLY:'+id;
// Only an unambiguous standalone answer to a known confirmation request qualifies.
// Questions, quoted emails and general conversations remain available for review.
export function clearAttendanceReply(body:string){
 const first=body.trim();
 if(/\?/.test(first))return false;
 const text=first.toLowerCase().replace(/[’]/g,"'").replace(/[.!]+$/,'').trim();
 return /^(yes|confirmed|confirm|i confirm|we confirm|i'll be there|we'll be there|i will be there|we will be there|yes,? (i'll|we'll|i will|we will) be there)$/.test(text);
}
export async function recordAttendanceReply(tx:any,tenantId:string,incoming:any,replyToId?:string){
 if(!clearAttendanceReply(incoming.body||''))return false;
 const original=await tx.communication.findFirst({where:{tenantId,customerId:incoming.customerId,direction:'OUTBOUND',channel:incoming.channel,...(replyToId?{id:replyToId}:{toAddress:incoming.fromAddress})},orderBy:[{createdAt:'desc'},{id:'desc'}]});
 if(!original||!['QUEUED','SENT','DELIVERED','READ','ACCEPTED'].includes(original.deliveryStatus))return false;
 const context=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:attendanceReplyKey(original.id)}}}))?.value;
 if(context?.kind!=='CONFIRMATION'||context.customerId!==incoming.customerId||context.ticketId!==original.ticketId)return false;
 await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${context.ticketId} AND tenantId=${tenantId} FOR UPDATE`;
 const ticket=await tx.ticket.findFirst({where:{id:context.ticketId,tenantId,customerId:incoming.customerId,status:{in:['OPEN','CONFIRMED']},bookingDecision:{notIn:['REQUESTED','PENDING','REJECTED']}}});
 if(!ticket?.scheduledStart||+ticket.scheduledStart<=Date.now()||+new Date(context.scheduledStart)!==+ticket.scheduledStart)return false;
 const cancellation=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'PORTAL_CANCELLATION:'+ticket.id}}}))?.value;
 if(cancellation?.state==='PENDING')return false;
 const settingKey=attendanceKey(ticket.id),where={tenantId_settingKey:{tenantId,settingKey}},row=await tx.tenantSetting.findUnique({where}),current=attendanceFor(row?.value,ticket.scheduledStart);
 if(current.confirmedAt)return true;
 const value={...current,revision:current.revision+1,confirmedAt:new Date().toISOString()};
 await tx.tenantSetting.upsert({where,create:{tenantId,settingKey,value},update:{value}});
 if(ticket.status==='OPEN')await tx.ticket.update({where:{id:ticket.id,status:'OPEN'},data:{status:'CONFIRMED'}});
 await tx.communication.update({where:{id:incoming.id},data:{ticketId:ticket.id}});
 await tx.auditEntry.create({data:{tenantId,customerId:ticket.customerId,actorType:'SYSTEM',entityType:'TICKET',entityId:ticket.id,action:'CUSTOMER_ATTENDANCE_CONFIRMED',summary:'Customer confirmed the appointment by '+(incoming.channel==='EMAIL'?'email.':'text.'),details:{scheduledStart:value.scheduledStart,confirmedAt:value.confirmedAt,communicationId:incoming.id,replyToCommunicationId:original.id}}});
 return true;
}
