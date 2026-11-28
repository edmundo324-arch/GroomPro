import {selectCustomerRule} from './custom-rule-pet-targets';
import {runOverdueCustomerRules} from './custom-rule-retention';
import {runBalanceRules} from './custom-rule-balance-runner';
import {runUnfinishedBookingRules} from './custom-rule-booking-runner';
import {readAppointmentMessageSettings} from './appointment-message-store';
import {runOverdueTaskRules} from './custom-rule-task-runner';
import {sendCustomRuleMessage} from './custom-rule-message';
import {membershipRuleEvent,loadMembershipRuleEvent} from './custom-rule-membership-event';
import {db} from './db';
import {customRuleMatches,customRuleDraft,customRulePrefix,executableStaffEvents} from './custom-rule-policy';
import {selectCustomRule,type ExecutableCustomRule} from './custom-rule-plan';
import {ticketRuleEvent,ticketRuleEventCurrent} from './custom-rule-ticket-events';
import {recordRuleStaffAction} from './custom-rule-staff-actions';
import {platformRestriction} from './platform-restrictions';
import {isFeatureEnabled} from './feature-access';
export type RuleCursor={tenantId:string;auditId:string;taskKey?:string;bookingKey?:string;balanceKey?:string;retentionTicketId?:string};
export async function runCustomStaffRules(cursor:RuleCursor|null=null,client:any=db){
 const began=Date.now(),tenant=await client.tenant.findFirst({where:cursor&&(cursor.auditId||cursor.taskKey!==undefined||cursor.bookingKey!==undefined||cursor.balanceKey!==undefined||cursor.retentionTicketId!==undefined)?{id:cursor.tenantId}:cursor?{id:{gt:cursor.tenantId}}:{},orderBy:{id:'asc'}});if(!tenant)return {cursor:null};
 const tenantId=tenant.id,next={tenantId,auditId:''};if(await platformRestriction(tenantId)||!await isFeatureEnabled(tenantId,'CALENDAR'))return {cursor:next};
 const saved=await client.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:customRulePrefix}},select:{value:true}}),rules:ExecutableCustomRule[]=saved.map((r:any)=>r.value).filter((r:any)=>r?.state==='ACTIVE'&&executableStaffEvents.includes(r.event)).map((r:any)=>({...r,...customRuleDraft(r)}));
 if(!rules.length)return {cursor:next};
 const afterBalances=rules.some(r=>r.event==='CUSTOMER_OVERDUE')?{tenantId,auditId:'',retentionTicketId:''}:next;
 if(cursor?.retentionTicketId!==undefined||rules.every(r=>r.event==='CUSTOMER_OVERDUE')){const retentionTicketId=await runOverdueCustomerRules(client,tenant,rules,cursor?.retentionTicketId||'');return {cursor:retentionTicketId?{tenantId,auditId:'',retentionTicketId}:next};}
 const afterBookings=rules.some(r=>r.event==='BALANCE_DUE')?{tenantId,auditId:'',balanceKey:''}:afterBalances;
 if(cursor?.balanceKey!==undefined||rules.every(r=>['BALANCE_DUE','CUSTOMER_OVERDUE'].includes(r.event))){const balanceKey=await runBalanceRules(client,tenant,rules,cursor?.balanceKey||'');return {cursor:balanceKey?{tenantId,auditId:'',balanceKey}:afterBalances};}
 const afterTasks=rules.some(r=>r.event==='BOOKING_ABANDONED')?{tenantId,auditId:'',bookingKey:''}:afterBookings;
 if(cursor?.bookingKey!==undefined||rules.every(r=>['BOOKING_ABANDONED','BALANCE_DUE','CUSTOMER_OVERDUE'].includes(r.event))){const bookingKey=await runUnfinishedBookingRules(client,tenant,rules,cursor?.bookingKey||'');return {cursor:bookingKey?{tenantId,auditId:'',bookingKey}:afterBookings};}
 if(cursor?.taskKey!==undefined||rules.every(r=>['TASK_OVERDUE','BOOKING_ABANDONED','BALANCE_DUE','CUSTOMER_OVERDUE'].includes(r.event))){const taskKey=await runOverdueTaskRules(client,tenant,rules,cursor?.taskKey||'');return {cursor:taskKey?{tenantId,auditId:'',taskKey}:afterTasks};}
 const earliest=new Date(Math.min(...rules.map(r=>Date.parse(r.activatedAt)))),includeExisting=rules.some(r=>r.existingRecords==='INCLUDE');
 const audits=await client.auditEntry.findMany({where:{tenantId,entityType:{in:['TICKET','MEMBERSHIP']},...(cursor?.auditId?{id:{gt:cursor.auditId}}:{}),...(!includeExisting?{occurredAt:{gte:earliest}}:{}),action:{in:['CREATE','REBOOK','ONLINE_BOOKING_REVIEW','CUSTOMER_ATTENDANCE_CONFIRMED','MOVE','CLOSE','NO_SHOW_FEE_CHARGED','NO_SHOW_FEE_TO_ACCOUNT','CUSTOMER_CANCELLATION','CANCELLATION_REVIEW','STATUS_CHANGE','MEMBERSHIP_STARTED','MEMBERSHIP_CANCEL','MEMBERSHIP_PAUSE','MEMBERSHIP_RESUME']}},orderBy:{id:'asc'},take:100});let last=cursor?.auditId||'';
 for(const audit of audits){if(last&&Date.now()-began>40000)return {cursor:{tenantId,auditId:last}};const event=ticketRuleEvent(audit)||membershipRuleEvent(audit);if(!event||!rules.some(r=>r.event===event)){last=audit.id;continue;}
  let selectedRuleId='';try{
   if(audit.entityType==='MEMBERSHIP'){
    const loaded=await loadMembershipRuleEvent(client,tenant,audit),plan=loaded?await selectCustomerRule(client,tenantId,loaded.customerId,rules,loaded.context):null;
    selectedRuleId=plan?.rule.id||'';
    if(loaded&&plan?.ready){
     const stillCurrent=async(tx:any)=>{const fresh=await loadMembershipRuleEvent(tx,tenant,audit);return !!fresh&&fresh.customerId===loaded.customerId&&(await selectCustomerRule(tx,tenantId,fresh.customerId,rules,fresh.context))?.rule.id===plan.rule.id;};
     for(const action of plan.rule.actions.filter(a=>a.kind!=='MESSAGE'))await recordRuleStaffAction(client,tenantId,plan.rule as any,action,{id:audit.id,customerId:loaded.customerId,timezone:loaded.timezone,validate:stillCurrent},loaded.values);
     for(const action of plan.rule.actions.filter(a=>a.kind==='MESSAGE'))await sendCustomRuleMessage(tenantId,plan.rule,action,audit.id,loaded.customerId,loaded.values,()=>stillCurrent(client),client);
    }
    last=audit.id;continue;
   }
   const ticket=await client.ticket.findFirst({where:{id:audit.entityId,tenantId},include:{location:true,customer:true,pets:{include:{pet:true}}}});if(!ticket?.customer?.active){last=audit.id;continue;}
   const records=await client.tenantSetting.findMany({where:{tenantId,settingKey:{in:['CUSTOMER_ATTENDANCE:'+ticket.id,'TICKET_VOID:'+ticket.id,'CUSTOMER_TAGS:'+ticket.customerId]}},select:{settingKey:true,value:true}}),get=(key:string)=>records.find((r:any)=>r.settingKey===key)?.value;
   const recent=await client.auditEntry.findMany({where:{tenantId,entityType:'TICKET',entityId:ticket.id},orderBy:[{occurredAt:'desc'},{id:'desc'}],take:100}),latest=recent.find((a:any)=>ticketRuleEvent(a)===event);
   const attendance=get('CUSTOMER_ATTENDANCE:'+ticket.id),current=ticketRuleEventCurrent(event,audit,ticket,attendance,!!get('TICKET_VOID:'+ticket.id),latest?.id||'');if(!current){last=audit.id;continue;}
   const [vip,upcoming,account]=await Promise.all([
    client.$queryRaw`SELECT id FROM Membership WHERE tenantId=${tenantId} AND customerId=${ticket.customerId} AND status IN ('ACTIVE','CANCELLATION_REQUESTED','PAUSE_REQUESTED') LIMIT 1`,
    client.ticket.findFirst({where:{tenantId,customerId:ticket.customerId,scheduledStart:{gt:new Date()},status:{in:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY']},bookingDecision:{notIn:['REQUESTED','PENDING']}},select:{id:true}}),
    client.$queryRaw`SELECT balanceCents FROM Customer WHERE id=${ticket.customerId} AND tenantId=${tenantId}`
   ]);
   const context={id:audit.id,event,occurredAt:new Date(audit.occurredAt).toISOString(),locationId:ticket.locationId,current,facts:{vipActive:!!vip.length,hasUpcomingAppointment:!!upcoming,attendanceConfirmed:!!attendance?.confirmedAt&&!!ticket.scheduledStart&&+new Date(attendance.scheduledStart)===+new Date(ticket.scheduledStart),tagIds:get('CUSTOMER_TAGS:'+ticket.customerId)?.tagIds||[]}},plan=await selectCustomerRule(client,tenantId,ticket.customerId,rules,context);if(!plan?.ready){last=audit.id;continue;}selectedRuleId=plan.rule.id;
   const zone=ticket.location.timezone,values={firstName:ticket.customer.firstName,location:ticket.location.name,customerName:[ticket.customer.firstName,ticket.customer.lastName].filter(Boolean).join(' '),petName:ticket.pets.map((p:any)=>p.pet.name).join(', '),businessName:tenant.name,...(ticket.scheduledStart?{appointmentDate:new Date(ticket.scheduledStart).toLocaleDateString('en-US',{timeZone:zone}),appointmentTime:new Date(ticket.scheduledStart).toLocaleTimeString('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'})}:{}),...(account.length?{balanceDue:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(account[0].balanceCents)/100)}:{})};
   const stillCurrent=async(tx:any)=>{
     const fresh=await tx.ticket.findFirst({where:{tenantId,id:ticket.id}}),state=await tx.tenantSetting.findMany({where:{tenantId,settingKey:{in:['CUSTOMER_ATTENDANCE:'+ticket.id,'TICKET_VOID:'+ticket.id,'CUSTOMER_TAGS:'+ticket.customerId]}},select:{settingKey:true,value:true}}),entries=await tx.auditEntry.findMany({where:{tenantId,entityType:'TICKET',entityId:ticket.id},orderBy:[{occurredAt:'desc'},{id:'desc'}],take:100});
     if(!fresh||fresh.customerId!==ticket.customerId||plan.rule.locationIds.length&&!plan.rule.locationIds.includes(fresh.locationId))return false;
     const liveAttendance=state.find((r:any)=>r.settingKey==='CUSTOMER_ATTENDANCE:'+ticket.id)?.value;
     const [liveVip,liveUpcoming]=await Promise.all([tx.$queryRaw`SELECT id FROM Membership WHERE tenantId=${tenantId} AND customerId=${ticket.customerId} AND status IN ('ACTIVE','CANCELLATION_REQUESTED','PAUSE_REQUESTED') LIMIT 1`,tx.ticket.findFirst({where:{tenantId,customerId:ticket.customerId,scheduledStart:{gt:new Date()},status:{in:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY']},bookingDecision:{notIn:['REQUESTED','PENDING']}},select:{id:true}})]);
     if(!customRuleMatches(plan.rule,{vipActive:!!liveVip.length,hasUpcomingAppointment:!!liveUpcoming,attendanceConfirmed:!!liveAttendance?.confirmedAt&&!!fresh.scheduledStart&&+new Date(liveAttendance.scheduledStart)===+new Date(fresh.scheduledStart),tagIds:state.find((r:any)=>r.settingKey==='CUSTOMER_TAGS:'+ticket.customerId)?.value?.tagIds||[]}))return false;
     return ticketRuleEventCurrent(event,audit,fresh,state.find((r:any)=>r.settingKey==='CUSTOMER_ATTENDANCE:'+ticket.id)?.value,!!state.find((r:any)=>r.settingKey==='TICKET_VOID:'+ticket.id),entries.find((a:any)=>ticketRuleEvent(a)===event)?.id||'');
    };
   for(const action of plan.rule.actions.filter(a=>a.kind!=='MESSAGE'))await recordRuleStaffAction(client,tenantId,plan.rule as any,action,{id:audit.id,customerId:ticket.customerId,timezone:zone,validate:stillCurrent},values);
   if(['APPOINTMENT_CREATED','APPOINTMENT_CONFIRMED','CHECKED_IN','NO_SHOW'].includes(event))for(const action of plan.rule.actions.filter(a=>a.kind==='MESSAGE')){
    const settings=await readAppointmentMessageSettings(tenantId),origin=settings.policy.publicOrigin;let portalLink:string|undefined;
    if(origin){const url=new URL('/portal',origin);url.searchParams.set('tenant',tenantId);url.searchParams.set('location',ticket.locationId);portalLink=url.toString();}
    await sendCustomRuleMessage(tenantId,plan.rule,action,audit.id,ticket.customerId,{...values,...(portalLink?{portalLink}:{}),...(settings.policy.reviewLink?{reviewLink:settings.policy.reviewLink}:{})},()=>stillCurrent(client),client);
   }
  }catch(error){const settingKey='CUSTOM_RULE_ERROR:'+audit.id,value={auditId:audit.id,entityType:audit.entityType,entityId:audit.entityId,customerId:audit.customerId||null,ruleId:selectedRuleId,checkedAt:new Date().toISOString(),message:(error as Error).message};await client.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey}},create:{tenantId,settingKey,value},update:{value}});}
  last=audit.id;
 }return {cursor:audits.length===100?{tenantId,auditId:last}:rules.some(r=>r.event==='TASK_OVERDUE')?{tenantId,auditId:'',taskKey:''}:afterTasks};
}
