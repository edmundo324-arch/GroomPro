import {db} from './db';
import {emailAddress,emailEventStatus,emailDeliveryCanAdvance,emailDeliveryMessage} from './email-delivery';
export async function recordEmailDelivery(tenantId:string,from:string,event:any,eventId:string){
 const status=emailEventStatus[event?.type],data=event?.data,at=new Date(event?.created_at);
 if(!status)return;
 if(!data||typeof data.email_id!=='string'||data.email_id.length>191||!data.email_id||!Number.isFinite(+at)||+at>Date.now()+300000||typeof data.from!=='string'||emailAddress(data.from)!==emailAddress(from)||!Array.isArray(data.to)||!data.to.every((v:unknown)=>typeof v==='string'))throw Error('Invalid email event.');
 const tagged=data.tags?.groompro_communication;
 if(tagged!==undefined&&(typeof tagged!=='string'||tagged.length>191))throw Error('Invalid email event.');
 const match=await db.communication.findFirst({where:{tenantId,channel:'EMAIL',direction:'OUTBOUND',...(tagged?{id:tagged}:{externalId:data.email_id})}});
 if(!match)return;
 await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Communication WHERE id=${match.id} AND tenantId=${tenantId} FOR UPDATE`;
  const row=await tx.communication.findFirst({where:{id:match.id,tenantId,channel:'EMAIL',direction:'OUTBOUND'}});
  if(!row||!row.toAddress||!row.fromAddress||emailAddress(row.fromAddress)!==emailAddress(data.from)||!data.to.some((v:string)=>emailAddress(v)===emailAddress(row.toAddress!))||(row.externalId&&row.externalId!==data.email_id))return;
  const settingKey='EMAIL_DELIVERY:'+row.id,where={tenantId_settingKey:{tenantId,settingKey}},previous=(await tx.tenantSetting.findUnique({where}))?.value as any;
  if(previous?.eventId===eventId||previous?.at&&+at<+new Date(previous.at)||!emailDeliveryCanAdvance(row.deliveryStatus,status))return;
  await tx.communication.update({where:{id:row.id},data:{externalId:data.email_id,deliveryStatus:status,...(['SENT','DELIVERED','COMPLAINED'].includes(status)?{sentAt:row.sentAt||at}:{}),deliveryError:['DELAYED','BOUNCED','COMPLAINED','SUPPRESSED','FAILED'].includes(status)?emailDeliveryMessage(status):null}});
  const value={eventId,type:event.type,status,at:at.toISOString()};
  await tx.tenantSetting.upsert({where,create:{tenantId,settingKey,value},update:{value}});
  await tx.auditEntry.create({data:{tenantId,actorType:'SYSTEM',entityType:'CUSTOMER',entityId:row.customerId,customerId:row.customerId,action:'EMAIL_DELIVERY',summary:emailDeliveryMessage(status),details:{communicationId:row.id,providerEmailId:data.email_id,...value}}});
 });
}
