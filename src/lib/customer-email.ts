import {db} from './db';

export function customerEmailConfig(tenantId:string):{apiKey:string;from:string}|null{
 try{
  const value=JSON.parse(process.env.GROOMPRO_AGREEMENT_EMAIL_TENANTS_JSON||'{}')[tenantId];
  return typeof value?.apiKey==='string'&&value.apiKey.trim()&&typeof value?.from==='string'&&value.from.trim()?{apiKey:value.apiKey,from:value.from}:null;
 }catch{return null;}
}

export async function sendCustomerEmail({tenantId,customerId,body,document}:{tenantId:string;customerId:string;body:string;document?:{id:string;ticketId:string;subject:string;html:string;expectedEmail:string}}){
 const customer=await db.customer.findFirst({where:{id:customerId,tenantId,active:true}});
 const text=body.trim();
 if(!customer?.email||!text||text.length>10000)throw Error('Choose a customer with an email address and enter a message of up to 10,000 characters.');
 if(document&&customer.email!==document.expectedEmail)throw Error('The customer’s email address changed. Reopen the receipt action to review it.');
 if(document&&!await db.ticket.findFirst({where:{id:document.ticketId,tenantId,customerId}}))throw Error('This appointment no longer belongs to the selected customer. Refresh it before sending.');
 const tenant=await db.tenant.findUniqueOrThrow({where:{id:tenantId},select:{name:true}});
 const config=customerEmailConfig(tenantId),subject=document?.subject||`A message from ${tenant.name}`;
 let communication;
 try{communication=await db.communication.create({data:{...(document?{id:document.id,ticketId:document.ticketId}:{}),tenantId,customerId:customer.id,channel:'EMAIL',direction:'OUTBOUND',body:text,subject,toAddress:customer.email,fromAddress:config?.from||null,deliveryStatus:config?'SENDING':'NOT_CONFIGURED'}});}catch(error){
  if(!document||(error as {code?:string}).code!=='P2002')throw error;
  const existing=await db.communication.findFirst({where:{id:document.id,tenantId,customerId,ticketId:document.ticketId,channel:'EMAIL',direction:'OUTBOUND'}});
  if(!existing)throw Error('This email request could not be matched. Refresh the ticket before trying again.');
  return {communication:existing,message:existing.deliveryStatus==='ACCEPTED'?'The email service already accepted this copy. Delivery has not been confirmed.':'This email request was already recorded ('+existing.deliveryStatus+'). Check Communication History before sending another copy.'};
 }
 if(!config)return {communication,message:'Your email was saved but not sent. Ask the business owner to finish setting up email delivery.'};
 try{
  const response=await fetch('https://api.resend.com/emails',{
   method:'POST',headers:{Authorization:'Bearer '+config.apiKey,'Content-Type':'application/json','Idempotency-Key':'communication-'+communication.id},
   body:JSON.stringify({from:config.from,to:[customer.email],subject,text,...(document?{html:document.html}:{})}),signal:AbortSignal.timeout(12000),
  });
  // A timeout/server failure may follow acceptance. Never invite a blind resend.
  if(response.status>=500||response.status===408)throw Error('Uncertain provider outcome');
  if(!response.ok){
   const failed=await db.communication.update({where:{id:communication.id},data:{deliveryStatus:'FAILED',deliveryError:'The email service rejected this message.'}});
   return {communication:failed,message:'The email was not sent. Ask the business owner to check the email service before trying again.'};
  }
  const result=await response.json();if(typeof result.id!=='string'||!result.id)throw Error('Missing provider receipt');
  const accepted=await db.communication.update({where:{id:communication.id},data:{externalId:result.id,deliveryStatus:'ACCEPTED'}});
  return {communication:accepted,message:'The email service accepted your message. Delivery has not been confirmed.'};
 }catch{
  await db.communication.updateMany({where:{id:communication.id,deliveryStatus:'SENDING'},data:{deliveryStatus:'UNKNOWN',deliveryError:'Delivery outcome unknown. Check the email service before sending again.'}});
  return {communication:await db.communication.findUniqueOrThrow({where:{id:communication.id}}),message:'We could not confirm whether the email was sent. Ask the business owner to check the email service before sending it again.'};
 }
}
