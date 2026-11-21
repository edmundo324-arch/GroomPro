import {messageDeliveryCounts} from './report-calculations';
export {messageDeliveryCounts} from './report-calculations';
import {db} from './db';

export async function appointmentDeliveryReport(tenantId:string,locationId:string,start:Date,end:Date){
 const records=await db.communication.findMany({where:{tenantId,direction:'OUTBOUND',id:{startsWith:'appt_'},createdAt:{gte:start,lt:end},ticket:{tenantId,locationId}},select:{subject:true,channel:true,deliveryStatus:true}});
 return messageDeliveryCounts(records);
}
