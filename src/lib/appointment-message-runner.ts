import {lifecyclePlans,lifecycleMessage,rebookingCandidateIds} from './appointment-lifecycle-messages';
import {createHash} from 'node:crypto';
import {db} from './db';
import {initializeAppointmentMessageSettings,readAppointmentMessageSettings} from './appointment-message-store';
import {planAppointmentMessages,renderAppointmentMessage} from './appointment-message-plan';
import {attendanceKey} from './customer-attendance';
import {platformRestriction} from './platform-restrictions';
import {isFeatureEnabled,customerContactFeature} from './feature-access';
import {configFor,sendCustomerSms} from './sms';
import {customerEmailConfig,sendCustomerEmail} from './customer-email';
import {readPortalPolicy} from './portal-policy-store';
import {getTenantNumberSetting} from './customer-account';
import {normalizePhone} from './customer';
export const messageRuntimeKey='APPOINTMENT_MESSAGE_RUNTIME';
export type MessageCursor={tenantId:string;ticketId:string};
export function appointmentMessageId(tenantId:string,ticketId:string,start:Date,kind:string,at:Date,channel:string){return 'appt_'+createHash('sha256').update(JSON.stringify([tenantId,ticketId,start.toISOString(),kind,at.toISOString(),channel])).digest('hex');}
const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
async function status(tenantId:string,message:string,checkedAt:Date){const value={checkedAt:checkedAt.toISOString(),message},where={tenantId_settingKey:{tenantId,settingKey:messageRuntimeKey}};await db.tenantSetting.upsert({where,create:{tenantId,settingKey:messageRuntimeKey,value},update:{value}});}
export async function runAppointmentMessages(cursor:MessageCursor|null=null){
 const began=Date.now(),now=new Date();
 const tenant=await db.tenant.findFirst({where:cursor?.ticketId?{id:cursor.tenantId}:cursor?{id:{gt:cursor.tenantId}}:{},orderBy:{id:'asc'}});
 if(!tenant)return {cursor:null};
 const tenantId=tenant.id,nextTenant={tenantId,ticketId:''};
 if(await platformRestriction(tenantId)||!await isFeatureEnabled(tenantId,'MESSAGING')){await status(tenantId,'Automatic messages are unavailable for this business access or subscription.',now);return {cursor:nextTenant};}
 const settings=await initializeAppointmentMessageSettings(tenantId);
 if(!settings.policy.enabled){await status(tenantId,'Automatic appointment messages are turned off.',now);return {cursor:nextTenant};}
 if(!settings.policy.publicOrigin){await status(tenantId,'Save the customer website address in these settings before GroomPro can send appointment links.',now);return {cursor:nextTenant};}
 const rebookingCandidates=settings.policy.rebookingEnabled?await rebookingCandidateIds(db,tenantId,cursor?.ticketId||''):[];
 const tickets=await db.ticket.findMany({where:{tenantId,...(cursor?.ticketId?{id:{gt:cursor.ticketId}}:{}),OR:[{scheduledStart:{gt:now},status:{in:['OPEN','CONFIRMED']},bookingDecision:{notIn:['REQUESTED','PENDING']}},{status:'READY',pickupAt:{gte:new Date(settings.lifecycleActiveSince||settings.activeSince!)}},{status:'CANCELLED',updatedAt:{gte:new Date(settings.lifecycleActiveSince||settings.activeSince!)}},{id:{in:rebookingCandidates.map((r:any)=>r.id)},status:'CLOSED'},...(settings.policy.reportCardMode==='AUTO'&&settings.reportCardActiveSince?[{status:'CLOSED' as const,closedAt:{gte:new Date(settings.reportCardActiveSince)}}]:[]),...(settings.policy.reviewEnabled&&settings.policy.reviewLink&&settings.reviewActiveSince?[{status:'CLOSED' as const,closedAt:{gte:new Date(settings.reviewActiveSince)}}]:[])]},select:{id:true},orderBy:{id:'asc'},take:100});
 let last=cursor?.ticketId||'',problem='';
 for(const entry of tickets){
  if(last&&Date.now()-began>45000){await status(tenantId,problem||'Scheduler is checking upcoming appointments.',new Date());return {cursor:{tenantId,ticketId:last}};}
  try{
   // Reload at dispatch rather than trusting a previously scheduled time or recipient.
   const ticket=await db.ticket.findFirst({where:{id:entry.id,tenantId},include:{location:true,customer:{include:{phones:{where:{smsEnabled:true},orderBy:{isPrimary:'desc'}}}},pets:{include:{pet:true}}}});
   if(!ticket||(!ticket.scheduledStart&&!ticket.closedAt)||!ticket.customer.active){last=entry.id;continue;}
   const current=await readAppointmentMessageSettings(tenantId),rows=await db.tenantSetting.findMany({where:{tenantId,settingKey:{in:[attendanceKey(ticket.id),'PORTAL_CANCELLATION:'+ticket.id]}}});
   const state=rows.find(row=>row.settingKey===attendanceKey(ticket.id))?.value as any,cancellation=rows.find(row=>row.settingKey==='PORTAL_CANCELLATION:'+ticket.id)?.value as any;
   if(!current.activeSince||!current.policy.publicOrigin){last=entry.id;continue;}
   const plans=[...planAppointmentMessages(ticket,state,current.policy,new Date(current.activeSince),new Date(),cancellation?.state==='PENDING'),...await lifecyclePlans(db,ticket,current.policy,new Date(current.lifecycleActiveSince||current.activeSince),new Date(),new Date(current.reviewActiveSince||Date.now()),new Date(current.reportCardActiveSince||Date.now()))];
   for(const plan of plans){const messageDate=ticket.scheduledStart||ticket.closedAt!;
    const portal=new URL('/portal',current.policy.publicOrigin);portal.searchParams.set('tenant',tenantId);portal.searchParams.set('location',ticket.locationId);
    const cancellationPolicy=await readPortalPolicy(tenantId),fee=await getTenantNumberSetting(tenantId,'NO_SHOW_FEE_CENTS',4500),zone=ticket.location.timezone;
    const values={reviewLink:current.policy.reviewLink,business:tenant.name,customer:[ticket.customer.firstName,ticket.customer.lastName].filter(Boolean).join(' '),firstName:ticket.customer.firstName,pets:ticket.pets.filter(p=>plan.kind!=='REBOOKING'||(p.pet.customerId===ticket.customerId&&p.pet.active)).map(p=>p.pet.name).join(', '),appointmentDate:ticket.scheduledStart?.toLocaleDateString('en-US',{timeZone:zone,weekday:'long',month:'long',day:'numeric',year:'numeric'})||'',appointmentTime:ticket.scheduledStart?.toLocaleTimeString('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'})||'',location:ticket.location.name,portalLink:portal.toString(),notice:cancellationPolicy.notice.amount+' '+cancellationPolicy.notice.unit.toLowerCase(),fee:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(fee/100)};
    const lifecycle=plan.kind==='CONFIRMATION'||plan.kind==='REMINDER'?null:lifecycleMessage(plan.kind,current.policy);
    const body=renderAppointmentMessage(lifecycle?.text||(plan.kind==='CONFIRMATION'?current.policy.confirmationText+'\n'+current.policy.feeReminder:current.policy.reminderText),values),subject=lifecycle?.subject||(plan.kind==='CONFIRMATION'?'Appointment confirmation request':'Appointment reminder');
    for(const channel of current.policy.channels){
     const id=appointmentMessageId(tenantId,ticket.id,messageDate,plan.kind,plan.at,channel);
     if(await db.communication.findFirst({where:{id,tenantId,customerId:ticket.customerId,ticketId:ticket.id}}))continue;
     // A preceding provider call may take time: recheck cancellation, confirmation and policy before the next send.
     const fresh=await db.ticket.findFirst({where:{id:ticket.id,tenantId},select:{id:true,tenantId:true,customerId:true,scheduledStart:true,status:true,bookingDecision:true,pickupAt:true,pickupCompletedAt:true,closedAt:true}}),latest=await readAppointmentMessageSettings(tenantId),latestRows=await db.tenantSetting.findMany({where:{tenantId,settingKey:{in:[attendanceKey(ticket.id),'PORTAL_CANCELLATION:'+ticket.id]}}});
     if(!fresh||(!fresh.scheduledStart&&!fresh.closedAt)||fresh.customerId!==ticket.customerId||+(fresh.scheduledStart||fresh.closedAt!)!==+messageDate||latest.revision!==current.revision||await platformRestriction(tenantId)||!await isFeatureEnabled(tenantId,'MESSAGING'))continue;
     const liveState=latestRows.find(r=>r.settingKey===attendanceKey(ticket.id))?.value as any,liveCancel=latestRows.find(r=>r.settingKey==='PORTAL_CANCELLATION:'+ticket.id)?.value as any;
     const freshPlans=lifecycle?await lifecyclePlans(db,{...ticket,...fresh},latest.policy,new Date(latest.lifecycleActiveSince||latest.activeSince),new Date(),new Date(latest.reviewActiveSince||Date.now()),new Date(latest.reportCardActiveSince||Date.now())):planAppointmentMessages({...ticket,...fresh},liveState,latest.policy,new Date(latest.activeSince),new Date(),liveCancel?.state==='PENDING');
     if(!freshPlans.some(p=>p.kind===plan.kind&&+p.at===+plan.at))continue;
     let result;
     if(channel==='SMS'){
      if(ticket.customer.appointmentSms===false||ticket.customer.invalidSmsNumber)continue;
      if(!configFor(tenantId)||!await isFeatureEnabled(tenantId,customerContactFeature)){problem='Texting setup or texting subscription needs attention.';continue;}
      const phone=ticket.customer.phones[0];if(!phone){problem='Some appointments have no customer number with texting enabled. Review their profiles.';continue;}
      const digits=normalizePhone(phone.number),to=phone.number.trim().startsWith('+')?'+'+phone.number.replace(/\D/g,''):digits.length===10?'+1'+digits:'+'+digits;
      result=await sendCustomerSms({tenantId,customerId:ticket.customerId,ticketId:ticket.id,phoneId:phone.id,subject,body,operation:{id,expectedPhone:to}});
     }else{
      if(ticket.customer.appointmentEmail===false||ticket.customer.invalidEmail)continue;
      if(!customerEmailConfig(tenantId)||!ticket.customer.email){problem='Email setup or a customer email address needs attention.';continue;}
      result=await sendCustomerEmail({tenantId,customerId:ticket.customerId,body,appointmentMessage:true,document:{id,ticketId:ticket.id,subject,expectedEmail:ticket.customer.email,html:'<p>'+escapeHtml(body).replace(/\n/g,'<br>')+'</p>'}});
     }
     if(['UNKNOWN','FAILED','NOT_CONFIGURED','SENDING'].includes(result.communication.deliveryStatus))problem='Review Communication History for messages whose delivery failed or could not be confirmed. GroomPro will not resend an uncertain copy automatically.';
    }
   }
  }catch{problem='An appointment message could not be prepared. Review appointment details, message wording and delivery setup.';}
  last=entry.id;
 }
 await status(tenantId,problem||'Scheduler checked upcoming appointments. Communication History shows individual delivery results.',new Date());
 return {cursor:tickets.length===100?{tenantId,ticketId:last}:nextTenant};
}
