import {selectCustomerRule} from './custom-rule-pet-targets';
import {overdueCustomerRule} from './custom-rule-retention';
import {customRuleDraft,customRulePrefix,type CustomRuleEvent} from './custom-rule-policy';
import {selectCustomRule,type ExecutableCustomRule} from './custom-rule-plan';
import {ticketRuleEvent,ticketRuleEventCurrent} from './custom-rule-ticket-events';
export const lifecycleRuleEvent=(kind:string):CustomRuleEvent|null=>({PICKUP:'READY',CHANGED:'APPOINTMENT_CHANGED',CANCELLED:'APPOINTMENT_CANCELLED',REVIEW:'CLOSED',REPORT_CARD:'CLOSED'} as Record<string,CustomRuleEvent>)[kind]||null;
export async function ticketCustomRule(client:any,ticket:any,kind:string){
 if(kind==='REBOOKING'){const plan=await overdueCustomerRule(client,ticket);const action=plan?.rule.actions.find(a=>a.kind==='MESSAGE');return plan&&action?{...plan,action}:null;}
 const event=lifecycleRuleEvent(kind);if(!event)return null;const tenantId=ticket.tenantId;
 const saved=await client.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:customRulePrefix}},select:{value:true}}),rules:ExecutableCustomRule[]=saved.map((r:any)=>r.value).filter((r:any)=>r?.state==='ACTIVE'&&r.event===event).map((r:any)=>({...r,...customRuleDraft(r)}));
 if(!rules.length)return null;
 const audits=await client.auditEntry.findMany({where:{tenantId,entityType:'TICKET',entityId:ticket.id,action:{in:['STATUS_CHANGE','ONLINE_BOOKING_REVIEW','MOVE','CLOSE','CUSTOMER_CANCELLATION','CANCELLATION_REVIEW']}},orderBy:[{occurredAt:'desc'},{id:'desc'}],take:100}),audit=audits.find((a:any)=>ticketRuleEvent(a)===event);if(!audit)return null;
 const rows=await client.tenantSetting.findMany({where:{tenantId,settingKey:{in:['CUSTOMER_ATTENDANCE:'+ticket.id,'TICKET_VOID:'+ticket.id,'CUSTOMER_TAGS:'+ticket.customerId]}},select:{settingKey:true,value:true}}),value=(key:string)=>rows.find((r:any)=>r.settingKey===key)?.value;
 const attendance=value('CUSTOMER_ATTENDANCE:'+ticket.id);if(!ticketRuleEventCurrent(event,audit,ticket,attendance,!!value('TICKET_VOID:'+ticket.id),audit.id))return null;
 const [vip,upcoming]=await Promise.all([client.$queryRaw`SELECT id FROM Membership WHERE tenantId=${tenantId} AND customerId=${ticket.customerId} AND status IN ('ACTIVE','CANCELLATION_REQUESTED','PAUSE_REQUESTED') LIMIT 1`,client.ticket.findFirst({where:{tenantId,customerId:ticket.customerId,scheduledStart:{gt:new Date()},status:{in:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY']},bookingDecision:{notIn:['REQUESTED','PENDING']}},select:{id:true}})]);
 const plan=await selectCustomerRule(client,tenantId,ticket.customerId,rules,{id:audit.id,event,occurredAt:new Date(audit.occurredAt).toISOString(),locationId:ticket.locationId,current:true,facts:{vipActive:!!vip.length,hasUpcomingAppointment:!!upcoming,attendanceConfirmed:!!attendance?.confirmedAt&&!!ticket.scheduledStart&&+new Date(attendance.scheduledStart)===+new Date(ticket.scheduledStart),tagIds:value('CUSTOMER_TAGS:'+ticket.customerId)?.tagIds||[]}});
 const action=plan?.rule.actions.find(a=>a.kind==='MESSAGE');if(!plan||!action||event==='CLOSED'&&action.replaces!==kind)return null;
 return {...plan,action,eventId:audit.id,eventAt:new Date(audit.occurredAt)};
}

export async function customLifecyclePlans(client:any,ticket:any,policy:any){
 const result:{kind:'PICKUP'|'CHANGED'|'CANCELLED'|'REVIEW'|'REPORT_CARD'|'REBOOKING';at:Date}[]=[];
 for(const kind of ['PICKUP','CHANGED','CANCELLED','REVIEW','REPORT_CARD','REBOOKING'] as const){
  if(kind==='REPORT_CARD'&&policy.reportCardMode!=='AUTO')continue;
  const matched=await ticketCustomRule(client,ticket,kind);if(!matched)continue;
  if(kind==='REPORT_CARD'){const card=await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:ticket.tenantId,settingKey:'CUSTOMER_REPORT_CARD:'+ticket.id}}});if(!card?.value?.revision)continue;}
  let at=kind==='PICKUP'?new Date(ticket.pickupAt||matched.eventAt):['REVIEW','REPORT_CARD','REBOOKING'].includes(kind)?new Date(ticket.closedAt||matched.eventAt):matched.eventAt;
  if(kind==='CHANGED'){const history=await client.ticketScheduleHistory.findFirst({where:{tenantId:ticket.tenantId,ticketId:ticket.id,changeType:'MOVED',newStart:ticket.scheduledStart},orderBy:{changedAt:'desc'}});if(history)at=new Date(history.changedAt);}
  result.push({kind,at});
 }return result;
}
export async function hasCustomLifecycleMessages(client:any,tenantId:string){const rows=await client.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:customRulePrefix}},select:{value:true}});return rows.some((r:any)=>r.value?.state==='ACTIVE'&&['CUSTOMER_OVERDUE','READY','APPOINTMENT_CHANGED','APPOINTMENT_CANCELLED','CLOSED'].includes(r.value.event)&&r.value.actions?.some((a:any)=>a.kind==='MESSAGE'));}
