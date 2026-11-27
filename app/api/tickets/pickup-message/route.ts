import {readPortalPolicy} from '@/src/lib/portal-policy-store';
import {getTenantNumberSetting} from '@/src/lib/customer-account';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {platformSession} from '@/src/lib/platform-access';
import {requestLocation} from '@/src/lib/request-location';
import {readAppointmentMessageSettings} from '@/src/lib/appointment-message-store';
import {renderAppointmentMessage} from '@/src/lib/appointment-message-plan';
import {appointmentMessageId} from '@/src/lib/appointment-message-runner';
import {sendCustomerSms} from '@/src/lib/sms';
import {normalizePhone} from '@/src/lib/customer';
async function handle(r:NextRequest){
 const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}}),session=await platformSession(r);
 if(!session)return reply({error:'Employee PIN is required.'},401);
 try{
 const b=r.method==='GET'?Object.fromEntries(r.nextUrl.searchParams):await r.json(),tenantId=session.tenantId,locationId=await requestLocation(r,tenantId);
 const ticket=await db.ticket.findFirst({
 where:{id:String(b.ticketId||''),tenantId,locationId},
 include:{tenant:{select:{name:true}},location:true,
 customer:{include:{phones:{where:{smsEnabled:true},orderBy:{isPrimary:'desc'}}}},
 pets:{include:{pet:{select:{name:true}}}}}
 });
 if(!ticket)return reply({error:'This appointment could not be found at this location.'},404);
 if(b.purpose==='CUSTOMER'){
  if(r.method==='GET')return reply({body:'',mode:'COMPOSE',customerId:ticket.customerId,phones:ticket.customer.phones.map(p=>({id:p.id,number:p.number})),pets:ticket.pets.map(p=>p.pet.name).join(', ')});
  if(b.action!=='SEND'||!/^[-a-zA-Z0-9]{16,80}$/.test(String(b.requestKey||'')))return reply({error:'Reopen this message before sending.'},400);
  const phone=ticket.customer.phones.find(p=>p.id===b.phoneId);if(!phone||phone.number!==b.phoneNumber)throw Error('Review the customer’s texting number before continuing.');
  const digits=normalizePhone(phone.number),expectedPhone=phone.number.trim().startsWith('+')?'+'+phone.number.replace(/\D/g,''):digits.length===10?'+1'+digits:'+'+digits;
  const result=await sendCustomerSms({tenantId,customerId:ticket.customerId,ticketId:ticket.id,phoneId:phone.id,body:String(b.body||''),subject:'Appointment message',operation:{id:'ticket_text_'+ticket.id+'_'+b.requestKey,expectedPhone}});
  await db.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'TICKET',entityId:ticket.id,customerId:ticket.customerId,action:'CUSTOMER_TEXT_REQUESTED',summary:result.message,details:{communicationId:result.communication.id,deliveryStatus:result.communication.deliveryStatus}}});
  return reply({message:result.message,deliveryStatus:result.communication.deliveryStatus});
 }
 if(ticket.status!=='READY'||!ticket.pickupAt||ticket.pickupCompletedAt)return reply({error:'This appointment is no longer Ready for Pickup. Reopen it before preparing a pickup text.'},409);
 const {policy}=await readAppointmentMessageSettings(tenantId),zone=ticket.location.timezone;
 if(r.method==='GET'){
 const cancellation=await readPortalPolicy(tenantId),fee=await getTenantNumberSetting(tenantId,'NO_SHOW_FEE_CENTS',4500);
 const values={notice:cancellation.notice.amount+' '+cancellation.notice.unit.toLowerCase(),fee:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(fee/100),business:ticket.tenant.name,customer:[ticket.customer.firstName,ticket.customer.lastName].join(' '),firstName:ticket.customer.firstName,pets:ticket.pets.map(p=>p.pet.name).join(', '),location:ticket.location.name,appointmentDate:ticket.scheduledStart?.toLocaleDateString('en-US',{timeZone:zone})||'',appointmentTime:ticket.scheduledStart?.toLocaleTimeString('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'})||'',portalLink:policy.publicOrigin?new URL('/portal?tenant='+encodeURIComponent(tenantId)+'&location='+encodeURIComponent(locationId),policy.publicOrigin).toString():'',reviewLink:policy.reviewLink};
 return reply({body:renderAppointmentMessage(policy.pickupText,values),mode:policy.pickupTextAction,readyAt:ticket.pickupAt,phones:ticket.customer.phones.map(p=>({id:p.id,number:p.number})),pets:values.pets});
 }
 if(Date.parse(b.readyAt)!==+ticket.pickupAt)return reply({error:'This completion changed while the message was open. Close this message and review the appointment.'},409);
 if(b.action==='CANCEL')return await db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticket.id} AND tenantId=${tenantId} FOR UPDATE`;
 const fresh=await tx.ticket.findFirst({where:{id:ticket.id,tenantId,locationId}});
 if(fresh?.status!=='READY'||fresh.pickupCompletedAt||fresh.pickupAt?.toISOString()!==ticket.pickupAt!.toISOString())return reply({error:'This completion changed. Review the appointment before cancelling its pickup text.'},409);
 if(await tx.communication.findFirst({where:{tenantId,ticketId:ticket.id,channel:'SMS',createdAt:{gte:ticket.pickupAt!}}}))return reply({error:'A text request already exists for this completion. It may already be with the texting service and cannot be recalled here.'},409);
 const settingKey='PICKUP_TEXT_CANCELLED:'+ticket.id,value={readyAt:ticket.pickupAt!.toISOString(),cancelledAt:new Date().toISOString(),employeeId:session.user.id};
 await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey}},create:{tenantId,settingKey,value},update:{value}});
 await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'TICKET',entityId:ticket.id,customerId:ticket.customerId,action:'PICKUP_TEXT_CANCELLED',summary:'Cancelled the pending pickup text; appointment remains Ready.',details:value}});
 return reply({message:'Queued pickup text cancelled. The appointment is still Ready for Pickup.'});
 });
 if(!['SEND','RECORD'].includes(b.action)||b.action==='RECORD'&&policy.pickupTextAction==='COMPOSE'||b.action==='SEND'&&policy.pickupTextAction==='RECORD')return reply({error:'This action is not enabled in the tenant’s Texted Icon Action setting.'},400);
 const phone=ticket.customer.phones.find(p=>p.id===b.phoneId);if(!phone||phone.number!==b.phoneNumber)throw Error('Review the customer’s texting number before continuing.');
 const id=appointmentMessageId(tenantId,ticket.id,ticket.scheduledStart||ticket.closedAt||ticket.pickupAt,'PICKUP',ticket.pickupAt,'SMS');
 if(b.action==='SEND'&&await db.communication.findUnique({where:{id:'manual_'+id},select:{id:true}}))return reply({message:'A pickup text is already recorded for this completion. No additional text was sent.',deliveryStatus:'SENT'});
 let result;
 if(b.action==='RECORD'){
  const communication=await db.communication.upsert({where:{id:'manual_'+id},create:{id:'manual_'+id,tenantId,customerId:ticket.customerId,ticketId:ticket.id,channel:'SMS',direction:'OUTBOUND',toAddress:phone.number,subject:'Ready for pickup',body:'Staff recorded a pickup text sent outside GroomPro.',deliveryStatus:'SENT',sentAt:new Date()},update:{}});
  result={communication,message:'Pickup text record saved. No new text was sent by GroomPro.'};
 }else{
 const digits=normalizePhone(phone.number),expectedPhone=phone.number.trim().startsWith('+')?'+'+phone.number.replace(/\D/g,''):digits.length===10?'+1'+digits:'+'+digits;
 result=await sendCustomerSms({tenantId,customerId:ticket.customerId,ticketId:ticket.id,phoneId:phone.id,body:String(b.body||''),subject:'Ready for pickup',operation:{id,expectedPhone}});
 }
 await db.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'TICKET',entityId:ticket.id,customerId:ticket.customerId,action:b.action==='RECORD'?'PICKUP_TEXT_RECORDED':'PICKUP_TEXT_REQUESTED',summary:result.message,details:{communicationId:result.communication.id,deliveryStatus:result.communication.deliveryStatus}}});
 return reply({message:result.message,deliveryStatus:result.communication.deliveryStatus});
 }catch(e){return reply({error:e instanceof Error?e.message:'The pickup text could not be prepared. Review the ticket and try again.'},400)}
}
export const GET=withRequestPolicy(handle,{feature:'MESSAGING'});
export const POST=withRequestPolicy(handle,{feature:'MESSAGING'});
