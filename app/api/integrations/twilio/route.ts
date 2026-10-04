import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {configFor,smsCallbackUrl} from '@/src/lib/sms';
import {normalizePhone} from '@/src/lib/customer';
import {validTwilioSignature,deliveryCanAdvance} from '@/src/lib/twilio-signature';
export async function POST(r:NextRequest){
 const tenantId=r.nextUrl.searchParams.get('tenantId')||'',communicationId=r.nextUrl.searchParams.get('communicationId')||'';
 const config=configFor(tenantId),canonical=config&&smsCallbackUrl(config,tenantId,communicationId);
 if(!config||!canonical)return NextResponse.json({error:'Webhook unavailable.'},{status:404});
 const parameters=new URLSearchParams(await r.text());
 if(!validTwilioSignature(canonical,parameters,config.authToken,r.headers.get('x-twilio-signature')||'')||parameters.get('AccountSid')!==config.accountSid)return NextResponse.json({error:'Invalid signature.'},{status:403});
 const sid=parameters.get('MessageSid')||'';if(!/^SM[a-f0-9]{32}$/i.test(sid))return NextResponse.json({error:'Invalid message.'},{status:400});
 const status=String(parameters.get('MessageStatus')||parameters.get('SmsStatus')||'').toUpperCase();
 if(communicationId){
  await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM Communication WHERE id=${communicationId} AND tenantId=${tenantId} FOR UPDATE`;
   const existing=await tx.communication.findFirst({where:{id:communicationId,tenantId,direction:'OUTBOUND',fromAddress:config.from}});
   if(!existing||(existing.externalId&&existing.externalId!==sid)||!['ACCEPTED','QUEUED','SENDING','SENT','DELIVERED','READ','FAILED','UNDELIVERED'].includes(status)||!deliveryCanAdvance(existing.deliveryStatus,status))return;
   await tx.communication.update({where:{id:existing.id},data:{externalId:sid,deliveryStatus:status,...(['SENT','DELIVERED','READ'].includes(status)?{sentAt:existing.sentAt||new Date()}:{}),deliveryError:parameters.get('ErrorCode')?`Provider error ${parameters.get('ErrorCode')}`:null}});
  });
 }else{
  if(parameters.get('To')!==config.from)return NextResponse.json({error:'Recipient mismatch.'},{status:403});
  const from=parameters.get('From')||'',body=parameters.get('Body')||'';
  await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;if(await tx.communication.findFirst({where:{tenantId,externalId:sid}}))return;
   const phone=await tx.customerPhone.findFirst({where:{tenantId,normalized:normalizePhone(from)}});if(!phone)return;
   await tx.communication.create({data:{tenantId,customerId:phone.customerId,channel:'SMS',direction:'INBOUND',body,fromAddress:from,toAddress:config.from,externalId:sid,deliveryStatus:'RECEIVED',receivedAt:new Date()}});
  });
 }
 return new NextResponse('<Response/>',{status:200,headers:{'Content-Type':'text/xml'}});
}
