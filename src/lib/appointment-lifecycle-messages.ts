import {type AppointmentMessagePolicy} from './appointment-message-policy';
import {customerRetention,retentionSettingKey,retentionWeeks} from './report-retention';
export type LifecyclePlan={kind:'PICKUP'|'CHANGED'|'CANCELLED'|'REBOOKING'|'REVIEW'|'REPORT_CARD';at:Date};
const qualifying={lineType:'SERVICE',petId:{not:null},role:{in:['GROOM','BATH','PREP','DRY']}};
export async function lifecyclePlans(client:any,ticket:any,policy:AppointmentMessagePolicy,activeSince:Date,now=new Date(),reviewSince:Date=now,reportCardSince:Date=now):Promise<LifecyclePlan[]>{
 if(!policy.enabled||!Number.isFinite(+activeSince))return [];
 const plans:LifecyclePlan[]=[];
 if(policy.reportCardMode==='AUTO'&&ticket.status==='CLOSED'&&ticket.closedAt&&+new Date(ticket.closedAt)>=+reportCardSince){const card=await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:ticket.tenantId,settingKey:'CUSTOMER_REPORT_CARD:'+ticket.id}}});if((card?.value as any)?.revision)plans.push({kind:'REPORT_CARD',at:new Date(ticket.closedAt)});}
 if(policy.reviewEnabled&&policy.reviewLink&&ticket.status==='CLOSED'&&ticket.closedAt&&+new Date(ticket.closedAt)>=+reviewSince)plans.push({kind:'REVIEW',at:new Date(ticket.closedAt)});
 if(policy.pickupEnabled&&ticket.status==='READY'&&ticket.pickupAt&&!ticket.pickupCompletedAt&&+new Date(ticket.pickupAt)>=+activeSince){
  const sent=await client.communication.findFirst({where:{tenantId:ticket.tenantId,ticketId:ticket.id,subject:'Ready for pickup',id:{not:{startsWith:'appt_'}},sentAt:{gte:new Date(ticket.pickupAt)}}});
  if(!sent)plans.push({kind:'PICKUP',at:new Date(ticket.pickupAt)});
 }
 if(policy.changeEnabled&&['OPEN','CONFIRMED'].includes(ticket.status)&&!['REQUESTED','PENDING'].includes(ticket.bookingDecision)&&+new Date(ticket.scheduledStart)>+now){
  const move=await client.ticketScheduleHistory.findFirst({where:{tenantId:ticket.tenantId,ticketId:ticket.id,changeType:'MOVED',newStart:ticket.scheduledStart,changedAt:{gte:activeSince}},orderBy:{changedAt:'desc'}});
  if(move)plans.push({kind:'CHANGED',at:new Date(move.changedAt)});
 }
 if(policy.changeEnabled&&ticket.status==='CANCELLED'){
  const entries=await client.auditEntry.findMany({where:{tenantId:ticket.tenantId,entityType:'TICKET',entityId:ticket.id,occurredAt:{gte:activeSince},action:{in:['STATUS_CHANGE','CUSTOMER_CANCELLATION','CANCELLATION_REVIEW','ONLINE_BOOKING_REVIEW']}},orderBy:{occurredAt:'desc'},take:20});
  const entry=entries.find((r:any)=>r.action==='STATUS_CHANGE'?r.details?.newStatus==='CANCELLED':r.action==='CUSTOMER_CANCELLATION'?r.details?.state==='ON_TIME':r.action==='CANCELLATION_REVIEW'?!r.details?.keptAppointment&&['WAIVED','FEE_APPLIED'].includes(r.details?.state):r.action==='ONLINE_BOOKING_REVIEW'&&r.summary==='Declined online booking request.');
  if(entry)plans.push({kind:'CANCELLED',at:new Date(entry.occurredAt)});
 }
 if(policy.rebookingEnabled&&ticket.status==='CLOSED'&&ticket.closedAt&&ticket.pets?.some((p:any)=>p.pet.customerId===ticket.customerId&&p.pet.active)){
  const latest=await client.ticket.findFirst({where:{tenantId:ticket.tenantId,customerId:ticket.customerId,status:'CLOSED',closedAt:{lte:now},lines:{some:qualifying}},orderBy:[{closedAt:'desc'},{id:'desc'}],include:{lines:true}});
  if(latest?.id===ticket.id){
   const future=await client.ticket.findFirst({where:{tenantId:ticket.tenantId,customerId:ticket.customerId,scheduledStart:{gt:now},status:{in:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY']}}});
   if(!future){const setting=await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:ticket.tenantId,settingKey:retentionSettingKey}}});const weeks=setting?retentionWeeks(setting.value):6;
    const report=customerRetention([{id:ticket.customerId}],[latest],[],weeks,now,now,now,ticket.location.timezone);
    if(report.rows[0]?.overdue)plans.push({kind:'REBOOKING',at:new Date(ticket.closedAt)});
   }
  }
 }
 return plans.filter(p=>Number.isFinite(+p.at)&&+p.at<=+now);
}
export function lifecycleMessage(kind:LifecyclePlan['kind'],policy:AppointmentMessagePolicy){
 return {REPORT_CARD:{text:policy.reportCardText,subject:'Grooming report card'},REVIEW:{text:policy.reviewText,subject:'How was your visit?'},PICKUP:{text:policy.pickupText,subject:'Ready for pickup'},CHANGED:{text:policy.changeText,subject:'Appointment changed'},CANCELLED:{text:policy.cancellationText,subject:'Appointment cancelled'},REBOOKING:{text:policy.rebookingText,subject:'Plan your next grooming visit'}}[kind];
}

// Choose only the latest completed grooming per customer, rather than scanning
// every historical ticket on each scheduler pass. Dispatch still rechecks it.
export async function rebookingCandidateIds(client:any,tenantId:string,afterId:string,now=new Date()){
 return client.$queryRaw`SELECT t.id FROM Ticket t
 WHERE t.tenantId=${tenantId} AND t.id>${afterId} AND t.status='CLOSED' AND t.closedAt IS NOT NULL AND t.closedAt<=${now}
 AND EXISTS (SELECT 1 FROM TicketLine l WHERE l.ticketId=t.id AND l.lineType='SERVICE' AND l.petId IS NOT NULL AND l.role IN ('GROOM','BATH','PREP','DRY'))
 AND NOT EXISTS (SELECT 1 FROM Ticket n WHERE n.tenantId=t.tenantId AND n.customerId=t.customerId AND n.status='CLOSED' AND n.closedAt<=${now} AND (n.closedAt>t.closedAt OR (n.closedAt=t.closedAt AND n.id>t.id)) AND EXISTS (SELECT 1 FROM TicketLine nl WHERE nl.ticketId=n.id AND nl.lineType='SERVICE' AND nl.petId IS NOT NULL AND nl.role IN ('GROOM','BATH','PREP','DRY')))
 AND NOT EXISTS (SELECT 1 FROM Ticket f WHERE f.tenantId=t.tenantId AND f.customerId=t.customerId AND f.scheduledStart>${now} AND f.status IN ('OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY'))
 ORDER BY t.id LIMIT 100`;
}
