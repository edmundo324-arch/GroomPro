import {reconcileSales} from './report-calculations';
export {reconcileSales} from './report-calculations';
import {db} from './db';
import {isGiftCardLine} from './gift-card-line';

export async function salesReconciliationReport(tenantId:string,locationId:string,salesCents:number,refunds:any[],voids:any[],start:Date,end:Date){
 const current=refunds.filter(r=>+new Date(r.recordedAt)>=+start&&+new Date(r.recordedAt)<+end),ids=[...new Set<string>(current.map(r=>r.ticketId))];
 const tickets=ids.length?await db.ticket.findMany({where:{tenantId,locationId,id:{in:ids}},select:{id:true,lines:{select:{id:true,ticketId:true,sourceKey:true,description:true}}}}):[];
 return reconcileSales(salesCents,current,tickets.flatMap(t=>t.lines),voids,start,end);
}
