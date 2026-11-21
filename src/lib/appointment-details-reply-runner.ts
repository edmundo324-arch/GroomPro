import {detailsReplyPrefix} from './appointment-details-replies';
import {readAppointmentMessageSettings} from './appointment-message-store';
import {sendCustomerEmail,customerEmailConfig} from './customer-email';
import {sendCustomerSms,configFor} from './sms';
import {customerContactFeature,isFeatureEnabled} from './feature-access';
import {platformRestriction} from './platform-restrictions';
import {normalizePhone} from './phone-normalization';
import {renderAppointmentMessage} from './appointment-message-plan';
const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function runAppointmentDetailsReplies(client:any,tenant:{id:string;name:string}){
 const tenantId=tenant.id;
 if(await platformRestriction(tenantId)||!await isFeatureEnabled(tenantId,'MESSAGING'))return;
 const cursorKey='APPOINTMENT_DETAILS_REPLY_CURSOR',cursor=(await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:cursorKey}}}))?.value as any;
 const rows=await client.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:detailsReplyPrefix,...(cursor?.after?{gt:cursor.after}:{})}},orderBy:{settingKey:'asc'},take:50});
 for(const row of rows){const saved=row.value as any,id='details_'+row.settingKey.slice(detailsReplyPrefix.length);try{
  const finish=async(result:string)=>client.$transaction(async(tx:any)=>{await tx.auditEntry.create({data:{tenantId,customerId:saved.customerId,actorType:'SYSTEM',entityType:'COMMUNICATION',entityId:saved.incomingId,action:'APPOINTMENT_DETAILS_REPLY',summary:result,details:{replyId:id,ticketId:saved.ticketId}}});await tx.tenantSetting.deleteMany({where:{tenantId,settingKey:row.settingKey}});});
  const existing=await client.communication.findFirst({where:{tenantId,id}});if(existing){await finish('Appointment details reply already recorded: '+existing.deliveryStatus);continue;}
  const settings=await readAppointmentMessageSettings(tenantId,client);
  if(!settings.policy.enabled||!settings.policy.detailsReplyEnabled){await finish('Automatic appointment-details replies are turned off.');continue;}
  const ticket=await client.ticket.findFirst({where:{tenantId,id:saved.ticketId,customerId:saved.customerId,status:{in:['OPEN','CONFIRMED']},bookingDecision:{notIn:['REQUESTED','PENDING','REJECTED']}},include:{location:true,pets:{include:{pet:true}},customer:{include:{phones:true}}}});
  const cancellation=(await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'PORTAL_CANCELLATION:'+saved.ticketId}}}))?.value;
  if(!ticket?.scheduledStart||+new Date(ticket.scheduledStart)<=Date.now()||!ticket.customer.active||cancellation?.state==='PENDING'){await finish('Appointment details reply needs no automatic response because this appointment is no longer eligible.');continue;}
  const names=ticket.pets.filter((p:any)=>p.pet.active&&p.pet.customerId===saved.customerId).map((p:any)=>p.pet.name).join(', ');
  if(!names){await finish('Appointment details reply needs staff review because no current dog is linked.');continue;}
  const customer=ticket.customer,zone=ticket.location.timezone,start=new Date(ticket.scheduledStart),values={business:tenant.name,customer:[customer.firstName,customer.lastName].filter(Boolean).join(' '),firstName:customer.firstName||'',pets:names,appointmentDate:start.toLocaleDateString('en-US',{timeZone:zone,weekday:'long',month:'long',day:'numeric',year:'numeric'}),appointmentTime:start.toLocaleTimeString('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'}),location:ticket.location.name,portalLink:'',notice:'',fee:'',reviewLink:''},body=renderAppointmentMessage(settings.policy.detailsReplyText,values);
  let result;
  if(saved.channel==='SMS'){
   const phone=customer.phones.find((p:any)=>p.smsEnabled&&normalizePhone(p.number)===normalizePhone(saved.fromAddress||''));
   if(!phone||customer.appointmentSms===false||customer.invalidSmsNumber){await finish('Appointment-details text skipped because contact preferences changed.');continue;}
   if(!configFor(tenantId)||!await isFeatureEnabled(tenantId,customerContactFeature))continue;
   result=await sendCustomerSms({tenantId,customerId:customer.id,phoneId:phone.id,ticketId:ticket.id,body,subject:'Appointment details',operation:{id,expectedPhone:saved.fromAddress}});
  }else{
   if(customer.appointmentEmail===false||customer.invalidEmail||!customer.email||customer.email.toLowerCase()!==String(saved.fromAddress).toLowerCase()){await finish('Appointment-details email skipped because the customer’s address or preferences changed.');continue;}
   if(!customerEmailConfig(tenantId))continue;
   result=await sendCustomerEmail({tenantId,customerId:customer.id,body,appointmentMessage:true,document:{id,ticketId:ticket.id,subject:'Appointment details',expectedEmail:customer.email,html:'<p>'+escapeHtml(body).replace(/\n/g,'<br>')+'</p>'}});
  }
  await finish('Appointment details reply recorded: '+result.communication.deliveryStatus);
 }catch(error){await client.tenantSetting.updateMany({where:{tenantId,settingKey:row.settingKey},data:{value:{...saved,lastError:(error as Error).message,checkedAt:new Date().toISOString()}}});}}
 const value={after:rows.length===50?rows[rows.length-1].settingKey:''};await client.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey:cursorKey}},create:{tenantId,settingKey:cursorKey,value},update:{value}});
}
