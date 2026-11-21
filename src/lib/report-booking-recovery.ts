import {bookingRecovery} from './report-calculations';
export {bookingRecovery} from './report-calculations';
import {isGiftCardLine} from './gift-card-line';
import {db} from './db';
import {unfinishedBookingPrefix,bookingStages} from './unfinished-bookings';

export async function bookingRecoveryReport(tenantId:string,locationId:string,start:Date,end:Date){
 const candidates=await db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:unfinishedBookingPrefix},value:{path:'$.locationId',equals:locationId}},select:{value:true}});
 const accessible=await db.customer.findMany({where:{tenantId,id:{in:[...new Set(candidates.map(r=>(r.value as any)?.customerId).filter((id:any)=>typeof id==='string'))]}},select:{id:true}});const customerIds=new Set(accessible.map(c=>c.id));const records=candidates.filter(r=>customerIds.has((r.value as any)?.customerId));
 const ids=records.map(r=>(r.value as any)?.ticketId).filter((id:any)=>typeof id==='string');
 const tickets=ids.length?await db.ticket.findMany({where:{tenantId,locationId,id:{in:ids}},select:{id:true,orderNumber:true,customerId:true,locationId:true,status:true,closedAt:true,lines:{select:{sourceKey:true,description:true,totalCents:true}}}}):[];
 return bookingRecovery(records,tickets,start,end);
}
