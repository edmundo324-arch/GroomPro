import {db} from './db';
export function messageDeliveryCounts(messages:any[]){
 const rows=new Map<string,any>();
 for(const m of messages){const key=JSON.stringify([m.subject||'Appointment message',m.channel,m.deliveryStatus||'RECORDED']);const row=rows.get(key)||{name:m.subject||'Appointment message',channel:m.channel,status:m.deliveryStatus||'RECORDED',count:0};row.count++;rows.set(key,row);}
 return {total:messages.length,rows:[...rows.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.channel.localeCompare(b.channel)||a.status.localeCompare(b.status))};
}
export async function appointmentDeliveryReport(tenantId:string,locationId:string,start:Date,end:Date){
 const records=await db.communication.findMany({where:{tenantId,direction:'OUTBOUND',id:{startsWith:'appt_'},createdAt:{gte:start,lt:end},ticket:{tenantId,locationId}},select:{subject:true,channel:true,deliveryStatus:true}});
 return messageDeliveryCounts(records);
}
