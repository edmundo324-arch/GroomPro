import {createHash} from 'node:crypto';
import {attendanceReplyKey} from './attendance-replies';
export const detailsReplyPrefix='APPOINTMENT_DETAILS_REPLY:';
export function appointmentDetailsQuestion(body:string,names:string[]=[]){
 let text=body.trim().toLowerCase().replace(/[’]/g,"'").replace(/[?.!]+$/,'').trim();
 if(text.includes('\n')||text.length>240)return false;
 for(const name of names.filter(Boolean).sort((a,b)=>b.length-a.length))text=text.replaceAll(name.toLowerCase()+"'s",'my');
 return /^(what (time|day|date)( is (my|our|the) appointment)?|when is (my|our|the) appointment|what (day|date) and time is (my|our|the) appointment|can you (tell|remind) me (of )?(the )?(appointment )?(date and time|time|date))$/.test(text);
}
export async function queueAppointmentDetailsReply(tx:any,tenantId:string,incoming:any,replyToId?:string){
 if(typeof incoming.body!=='string'||incoming.body.length>240||!incoming.customerId)return false;
 const original=await tx.communication.findFirst({where:{tenantId,customerId:incoming.customerId,direction:'OUTBOUND',channel:incoming.channel,...(replyToId?{id:replyToId}:{toAddress:incoming.fromAddress})},orderBy:[{createdAt:'desc'},{id:'desc'}]});
 if(!original||!['QUEUED','SENT','DELIVERED','READ','ACCEPTED'].includes(original.deliveryStatus))return false;
 const context=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:attendanceReplyKey(original.id)}}}))?.value;
 if(!context?.ticketId||context.customerId!==incoming.customerId||context.ticketId!==original.ticketId)return false;
 const ticket=await tx.ticket.findFirst({where:{tenantId,id:context.ticketId,customerId:incoming.customerId},include:{pets:{include:{pet:{select:{name:true}}}}}});
 if(!ticket||!appointmentDetailsQuestion(incoming.body,ticket.pets.map((p:any)=>p.pet.name)))return false;
 const id=createHash('sha256').update(tenantId+':'+incoming.id).digest('hex'),settingKey=detailsReplyPrefix+id,value={incomingId:incoming.id,customerId:incoming.customerId,ticketId:ticket.id,channel:incoming.channel,fromAddress:incoming.fromAddress,queuedAt:new Date().toISOString()};
 await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey}},create:{tenantId,settingKey,value},update:{}});
 return true;
}
