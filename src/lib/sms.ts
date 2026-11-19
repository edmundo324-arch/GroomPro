import {deliveryMessage} from './human-communication';
import {db} from './db';
import {normalizePhone} from './customer';
import {customerContactFeature,isFeatureEnabled} from './feature-access';
export class TextingPlanError extends Error {
 constructor(){super('This subscription does not include customer texting. Ask the business owner to review the plan.')}
}
export type SmsConfig={accountSid:string;authToken:string;from:string;webhookUrl?:string};
export function configFor(tenantId:string):SmsConfig|null{try{const all=JSON.parse(process.env.GROOMPRO_SMS_TENANTS_JSON||'{}');const c=all[tenantId];return c&&/^AC[0-9a-f]{32}$/i.test(c.accountSid)&&c.authToken&&/^\+[1-9]\d{7,14}$/.test(c.from)?c:null}catch{return null}}
export function smsCallbackUrl(config:SmsConfig,tenantId:string,communicationId=''){try{if(!config.webhookUrl)return null;const url=new URL(config.webhookUrl);if(url.protocol!=='https:'||url.search||url.hash||url.username||url.password)return null;url.searchParams.set('tenantId',tenantId);if(communicationId)url.searchParams.set('communicationId',communicationId);return url.toString()}catch{return null}}
export const smsConfigured=(tenantId:string)=>!!configFor(tenantId);
export async function sendCustomerSms({tenantId,customerId,ticketId,phoneId,body,subject,operation}:{tenantId:string;customerId:string;ticketId?:string;phoneId?:string;body:string;subject?:string;operation?:{id:string;expectedPhone:string}}){
 if (!await isFeatureEnabled(tenantId, customerContactFeature)) throw new TextingPlanError();
 if(!body.trim()||body.length>1600)throw Error('Enter a text message of up to 1,600 characters before sending.');
 const customer=await db.customer.findFirst({where:{id:customerId,tenantId,active:true},include:{phones:{where:{smsEnabled:true},orderBy:{isPrimary:'desc'}}}});if(!customer)throw Error('Customer not found.');
 if(operation&&(customer.appointmentSms===false||customer.invalidSmsNumber))throw Error('Appointment texts are turned off or the number is marked invalid on this customer’s profile. Review their communication preferences before sending.');
 const phone=phoneId?customer.phones.find(p=>p.id===phoneId):customer.phones[0];if(!phone)throw Error('Choose a phone number from this customer’s profile that has texting enabled.');
 const digits=normalizePhone(phone.number),to=phone.number.trim().startsWith('+')?'+'+phone.number.replace(/\D/g,''):digits.length===10?'+1'+digits:'+'+digits;
 if(!/^\+[1-9]\d{7,14}$/.test(to))throw Error('Check the phone number, including its country code, before sending.');
 if(ticketId&&!await db.ticket.findFirst({where:{id:ticketId,tenantId,customerId}}))throw Error('Ticket does not belong to this customer.');
 if(operation&&to!==operation.expectedPhone)throw Error('The customer’s texting number changed. Review the appointment message before sending.');
 const config=configFor(tenantId);let communication;try{communication=await db.communication.create({data:{...(operation?{id:operation.id}:{}),tenantId,customerId,ticketId:ticketId||null,channel:'SMS',direction:'OUTBOUND',toAddress:to,fromAddress:config?.from||null,subject:subject||null,body,deliveryStatus:config?'SENDING':'NOT_CONFIGURED'}});}catch(error){
  if(!operation||(error as {code?:string}).code!=='P2002')throw error;
  const existing=await db.communication.findFirst({where:{id:operation.id,tenantId,customerId,ticketId:ticketId||null,channel:'SMS',direction:'OUTBOUND'}});
  if(!existing)throw Error('This text request could not be matched. Review Communication History before sending again.');
  return {communication:existing,message:'This text request was already recorded. Check Communication History for its delivery status.'};
 }
 if(!config)return{communication,message:'Your text was saved but not sent. Ask the business owner to finish setting up the texting service.'};
 try{const response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,{method:'POST',headers:{Authorization:'Basic '+Buffer.from(config.accountSid+':'+config.authToken).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({To:to,From:config.from,Body:body,...(smsCallbackUrl(config,tenantId,communication.id)?{StatusCallback:smsCallbackUrl(config,tenantId,communication.id)!}:{})}),signal:AbortSignal.timeout(15000)});if(operation&&(response.status>=500||response.status===408))throw Error('Uncertain provider outcome');const result=await response.json();if(operation&&response.ok&&(typeof result.sid!=='string'||!result.sid))throw Error('Missing provider receipt');if(!response.ok){const failed=await db.communication.update({where:{id:communication.id},data:{deliveryStatus:'FAILED',deliveryError:'Provider rejected the message. Check the messaging account.'}});return{communication:failed,message:'The text was not sent. Ask the business owner to check the texting account before trying again.'}}const status=String(result.status||'queued').toUpperCase();await db.communication.updateMany({where:{id:communication.id,deliveryStatus:'SENDING'},data:{externalId:result.sid,deliveryStatus:status,sentAt:['SENT','DELIVERED'].includes(status)?new Date():null}});const updated=await db.communication.findUniqueOrThrow({where:{id:communication.id}});return{communication:updated,message:deliveryMessage(updated.deliveryStatus)}}
 catch{await db.communication.updateMany({where:{id:communication.id,deliveryStatus:'SENDING'},data:{deliveryStatus:'UNKNOWN',deliveryError:'Delivery outcome unknown. Check provider before retrying.'}});const unknown=await db.communication.findUniqueOrThrow({where:{id:communication.id}});return{communication:unknown,message:deliveryMessage('UNKNOWN')}}
}
