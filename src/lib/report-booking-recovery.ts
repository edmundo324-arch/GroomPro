import {isGiftCardLine} from './gift-card-line';
import {db} from './db';
import {unfinishedBookingPrefix,bookingStages} from './unfinished-bookings';
export function bookingRecovery(records:any[],tickets:any[],start:Date,end:Date){
 const inPeriod=(date:unknown)=>typeof date==='string'&&Number.isFinite(Date.parse(date))&&Date.parse(date)>=+start&&Date.parse(date)<+end;
 const attempts=records.map(r=>r.value).filter(v=>v&&inPeriod(v.startedAt));const submitted=attempts.filter(v=>v.state==='COMPLETED').length;const stages=Object.entries(bookingStages).map(([id,name])=>({id,name,count:attempts.filter(v=>v.state!=='COMPLETED'&&(v.stage||'STARTED')===id).length}));const funnel={started:attempts.length,submitted,unfinished:attempts.length-submitted,submissionRate:attempts.length?submitted/attempts.length*100:null,stages};
 const rows:any[]=[];const seen=new Set<string>();let resumedBookings=0,closedSalesCents=0,closedTickets=0;
 for(const r of records){const v=r.value;if(v?.state!=='COMPLETED'||!v.resumedAfterInactivityAt||!v.ticketId||seen.has(v.ticketId))continue;
 const t=tickets.find(t=>t.id===v.ticketId&&t.customerId===v.customerId&&t.locationId===v.locationId);if(!t)continue;seen.add(t.id);
 const booked=inPeriod(v.completedAt),closed=t.status==='CLOSED'&&inPeriod(t.closedAt instanceof Date?t.closedAt.toISOString():t.closedAt);if(!booked&&!closed)continue;
 const sales=closed?(t.lines||[]).filter((l:any)=>!isGiftCardLine(l)&&!/^Customer Account Balance$/i.test(l.description||'')).reduce((n:number,l:any)=>n+l.totalCents,0):0;
 if(booked)resumedBookings++;if(closed){closedTickets++;closedSalesCents+=sales;}
 rows.push({ticketId:t.id,orderNumber:t.orderNumber,status:t.status,bookedAt:v.completedAt,closedAt:t.closedAt,bookedInPeriod:booked,closedInPeriod:closed,salesCents:sales});
 }
 return {resumedBookings,closedTickets,closedSalesCents,rows,funnel};
}
export async function bookingRecoveryReport(tenantId:string,locationId:string,start:Date,end:Date){
 const candidates=await db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:unfinishedBookingPrefix},value:{path:'$.locationId',equals:locationId}},select:{value:true}});
 const accessible=await db.customer.findMany({where:{tenantId,id:{in:[...new Set(candidates.map(r=>(r.value as any)?.customerId).filter((id:any)=>typeof id==='string'))]}},select:{id:true}});const customerIds=new Set(accessible.map(c=>c.id));const records=candidates.filter(r=>customerIds.has((r.value as any)?.customerId));
 const ids=records.map(r=>(r.value as any)?.ticketId).filter((id:any)=>typeof id==='string');
 const tickets=ids.length?await db.ticket.findMany({where:{tenantId,locationId,id:{in:ids}},select:{id:true,orderNumber:true,customerId:true,locationId:true,status:true,closedAt:true,lines:{select:{sourceKey:true,description:true,totalCents:true}}}}):[];
 return bookingRecovery(records,tickets,start,end);
}
