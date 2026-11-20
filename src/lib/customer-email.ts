import {prepareEmailReply,receivingDomain} from './email-replies';
import {emailDeliveryMessage} from './email-delivery';
import {db} from './db';

export function customerEmailConfig(tenantId:string):{apiKey:string;from:string;webhookSecret?:string;receivingDomain?:string}|null{
 try{
  const value=JSON.parse(process.env.GROOMPRO_AGREEMENT_EMAIL_TENANTS_JSON||'{}')[tenantId];
  return typeof value?.apiKey==='string'&&value.apiKey.trim()&&typeof value?.from==='string'&&value.from.trim()?{apiKey:value.apiKey,from:value.from,receivingDomain:receivingDomain(value.receivingDomain)||undefined,webhookSecret:typeof value.webhookSecret==='string'?value.webhookSecret:undefined}:null;
 }catch{return null;}
}

export async function sendCustomerEmail({tenantId,customerId,body,document,appointmentMessage=false}:{tenantId:string;customerId:string;body:string;appointmentMessage?:boolean;document?:{id:string;ticketId?:string;subject:string;html:string;expectedEmail:string;recipientEmail?:string}}){
 const customer=await db.customer.findFirst({where:{id:customerId,tenantId,active:true}});
 if(appointmentMessage&&customer&&(customer.appointmentEmail===false||customer.invalidEmail))throw Error('Appointment email is turned off or the address is marked invalid on this customer’s profile. Review their communication preferences before sending.');
 const text=body.trim(),deliveryEmail=document?.recipientEmail?.trim()||customer?.email;
 if(document?.recipientEmail&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(document.recipientEmail)||document.recipientEmail.length>254))throw Error("Enter a valid recipient email address.");
 if(!customer||!deliveryEmail||!text||text.length>10000)throw Error('Choose a customer with an email address and enter a message of up to 10,000 characters.');
 if(document&&deliveryEmail!==document.expectedEmail)throw Error('The customer’s email address changed. Reopen the receipt action to review it.');
 if(document?.ticketId&&!await db.ticket.findFirst({where:{id:document.ticketId,tenantId,customerId}}))throw Error('This appointment no longer belongs to the selected customer. Refresh it before sending.');
 const tenant=await db.tenant.findUniqueOrThrow({where:{id:tenantId},select:{name:true}});
 const config=customerEmailConfig(tenantId),subject=document?.subject||`A message from ${tenant.name}`;
 let communication;
 try{communication=await db.communication.create({data:{...(document?{id:document.id,ticketId:document.ticketId||null}:{}),tenantId,customerId:customer.id,channel:'EMAIL',direction:'OUTBOUND',body:text,subject,toAddress:deliveryEmail,fromAddress:config?.from||null,deliveryStatus:config?'SENDING':'NOT_CONFIGURED'}});}catch(error){
  if(!document||(error as {code?:string}).code!=='P2002')throw error;
  const existing=await db.communication.findFirst({where:{id:document.id,tenantId,customerId,ticketId:document.ticketId||null,toAddress:deliveryEmail,channel:'EMAIL',direction:'OUTBOUND'}});
  if(!existing||existing.toAddress!==deliveryEmail)throw Error('This email request could not be matched. Refresh the ticket before trying again.');
  return {communication:existing,message:existing.deliveryStatus==='ACCEPTED'?'The email service already accepted this copy. Delivery has not been confirmed.':'This email request was already recorded ('+existing.deliveryStatus+'). Check Communication History before sending another copy.'};
 }
 if(!config)return {communication,message:'Your email was saved but not sent. Ask the business owner to finish setting up email delivery.'};
 try{
  const replyTo=config.receivingDomain?await prepareEmailReply(tenantId,communication,config.receivingDomain):null;
  const response=await fetch('https://api.resend.com/emails',{
   method:'POST',headers:{Authorization:'Bearer '+config.apiKey,'Content-Type':'application/json','Idempotency-Key':'communication-'+communication.id},
   body:JSON.stringify({... (replyTo?{reply_to:replyTo}:{}),from:config.from,to:[deliveryEmail],subject,text,tags:[{name:'groompro_communication',value:communication.id}],...(document?{html:document.html}:{})}),signal:AbortSignal.timeout(12000),
  });
  // A timeout/server failure may follow acceptance. Never invite a blind resend.
  if(response.status>=500||response.status===408)throw Error('Uncertain provider outcome');
  if(!response.ok){
   await db.communication.updateMany({where:{id:communication.id,deliveryStatus:'SENDING'},data:{deliveryStatus:'FAILED',deliveryError:'The email service rejected this message.'}});const failed=await db.communication.findUniqueOrThrow({where:{id:communication.id}});
   return {communication:failed,message:emailDeliveryMessage(failed.deliveryStatus)};
  }
  const result=await response.json();if(typeof result.id!=='string'||!result.id)throw Error('Missing provider receipt');
  await db.communication.updateMany({where:{id:communication.id,deliveryStatus:'SENDING'},data:{externalId:result.id,deliveryStatus:'ACCEPTED'}});const accepted=await db.communication.findUniqueOrThrow({where:{id:communication.id}});
  return {communication:accepted,message:emailDeliveryMessage(accepted.deliveryStatus)};
 }catch{
  await db.communication.updateMany({where:{id:communication.id,deliveryStatus:'SENDING'},data:{deliveryStatus:'UNKNOWN',deliveryError:'Delivery outcome unknown. Check the email service before sending again.'}});
  const current=await db.communication.findUniqueOrThrow({where:{id:communication.id}});return {communication:current,message:emailDeliveryMessage(current.deliveryStatus)};
 }
}
