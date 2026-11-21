import {selectCustomerRule} from './custom-rule-pet-targets';
import {createHash} from 'node:crypto';
import {overdueCustomerRule} from './custom-rule-retention';
import {customRuleDraft,customRulePrefix} from './custom-rule-policy';
import {selectCustomRule} from './custom-rule-plan';
import {ticketRuleEvent,ticketRuleEventCurrent} from './custom-rule-ticket-events';
export const followUpClaimKey=(eventId:string)=>'CUSTOM_RULE_EVENT:'+createHash('sha256').update(eventId).digest('hex');
export async function ticketFollowUps(tx:any,tenantId:string,ticketId:string){
 const ticket=await tx.ticket.findFirst({where:{tenantId,id:ticketId},include:{location:true,customer:{select:{active:true}},pets:{include:{pet:true}}}});if(!ticket)throw Error('This ticket is unavailable. Reopen it from the customer’s history.');
 if(ticket.customer?.active===false)return {rows:[],timezone:ticket.location.timezone,customerId:ticket.customerId};
 const [saved,audits,state,vip,upcoming]=await Promise.all([
  tx.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:customRulePrefix}},select:{value:true}}),
  tx.auditEntry.findMany({where:{tenantId,entityType:'TICKET',entityId:ticketId},orderBy:[{occurredAt:'desc'},{id:'desc'}],take:100}),
  tx.tenantSetting.findMany({where:{tenantId,settingKey:{in:['CUSTOMER_ATTENDANCE:'+ticketId,'TICKET_VOID:'+ticketId,'CUSTOMER_TAGS:'+ticket.customerId]}},select:{settingKey:true,value:true}}),
  tx.$queryRaw`SELECT id FROM Membership WHERE tenantId=${tenantId} AND customerId=${ticket.customerId} AND status IN ('ACTIVE','CANCELLATION_REQUESTED','PAUSE_REQUESTED') LIMIT 1`,
  tx.ticket.findFirst({where:{tenantId,customerId:ticket.customerId,scheduledStart:{gt:new Date()},status:{in:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY']},bookingDecision:{notIn:['REQUESTED','PENDING']}},select:{id:true}})
 ]);
 const value=(key:string)=>state.find((r:any)=>r.settingKey===key)?.value,attendance=value('CUSTOMER_ATTENDANCE:'+ticketId),rules=saved.map((r:any)=>r.value).filter((r:any)=>r?.state==='ACTIVE').map((r:any)=>({...r,...customRuleDraft(r)})),seen=new Set<string>(),rows:any[]=[];
 for(const audit of audits){const event=ticketRuleEvent(audit);if(!event||seen.has(event))continue;seen.add(event);
  const current=ticketRuleEventCurrent(event,audit,ticket,attendance,!!value('TICKET_VOID:'+ticketId),audit.id);
  const plan=await selectCustomerRule(tx,tenantId,ticket.customerId,rules,{id:audit.id,event,occurredAt:new Date(audit.occurredAt).toISOString(),locationId:ticket.locationId,current,facts:{vipActive:!!vip.length,hasUpcomingAppointment:!!upcoming,attendanceConfirmed:!!attendance?.confirmedAt&&!!ticket.scheduledStart&&+new Date(attendance.scheduledStart)===+new Date(ticket.scheduledStart),tagIds:value('CUSTOMER_TAGS:'+ticket.customerId)?.tagIds||[]}});
  if(!plan)continue;
  const claim=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:followUpClaimKey(audit.id)}}});if(claim)continue;
  rows.push({eventId:audit.id,ruleId:plan.rule.id,revision:plan.rule.revision,name:plan.rule.name,dueAt:plan.dueAt.toISOString()});
 }
 const overdue=await overdueCustomerRule(tx,ticket,rules);
 if(overdue&&!await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:followUpClaimKey(overdue.eventId)}}}))rows.push({eventId:overdue.eventId,ruleId:overdue.rule.id,revision:overdue.rule.revision,name:overdue.rule.name,dueAt:overdue.dueAt.toISOString()});
 return {rows,timezone:ticket.location.timezone,customerId:ticket.customerId};
}
export async function stopTicketFollowUp(client:any,tenantId:string,userId:string,input:any){
 if(typeof input.reason!=='string'||!input.reason.trim()||input.reason.trim().length>1000)throw Error('Explain why this follow-up is no longer needed. The reason stays in the ticket’s history.');
 return client.$transaction(async(tx:any)=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  const current=await ticketFollowUps(tx,tenantId,input.ticketId),row=current.rows.find((r:any)=>r.eventId===input.eventId&&r.ruleId===input.ruleId&&r.revision===input.revision);
  if(!row)throw Error('This follow-up has changed or already started. Refresh the list; messages already submitted cannot be recalled.');
  const stoppedAt=new Date().toISOString(),settingKey=followUpClaimKey(row.eventId),value={eventId:row.eventId,ruleId:row.ruleId,revision:row.revision,stoppedAt,stoppedBy:userId,reason:input.reason.trim()};
  await tx.tenantSetting.create({data:{tenantId,settingKey,value}});
  await tx.auditEntry.create({data:{tenantId,customerId:current.customerId,actorType:'EMPLOYEE',actorUserId:userId,entityType:'TICKET',entityId:input.ticketId,action:'CUSTOM_RULE_FOLLOW_UP_STOPPED',summary:'Stopped pending follow-up: '+row.name,details:value}});
  return {stoppedAt};
 });
}
