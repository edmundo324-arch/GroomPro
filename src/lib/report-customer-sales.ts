import {isGiftCardLine} from './gift-card-line';
import {db} from './db';
export function customerSales(tickets:any[],asOf:Date){
 const customers=new Map<string,any>();let excludedBalanceCents=0;
 for(const t of tickets){if(t.status!=='CLOSED'||!t.closedAt||!Number.isFinite(new Date(t.closedAt).getTime())||new Date(t.closedAt)>asOf)continue;const lines=(t.lines||[]).filter((l:any)=>{if(isGiftCardLine(l))return false;if(/^Customer Account Balance$/i.test(l.description||'')){excludedBalanceCents+=l.totalCents;return false;}return true;});if(!lines.length)continue;
 const row=customers.get(t.customerId)||{id:t.customerId,name:[t.customer?.firstName,t.customer?.lastName].filter(Boolean).join(' ')||'Customer',active:t.customer?.active!==false,salesCents:0,tickets:0,firstVisit:t.closedAt,lastVisit:t.closedAt};row.salesCents+=lines.reduce((n:number,l:any)=>n+l.totalCents,0);row.tickets++;if(new Date(t.closedAt)<new Date(row.firstVisit))row.firstVisit=t.closedAt;if(new Date(t.closedAt)>new Date(row.lastVisit))row.lastVisit=t.closedAt;customers.set(t.customerId,row);}
 const rows=[...customers.values()].map(r=>({...r,averageCents:Math.round(r.salesCents/r.tickets)})).sort((a,b)=>b.salesCents-a.salesCents||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
 return {asOf:asOf.toISOString(),salesCents:rows.reduce((n,r)=>n+r.salesCents,0),customers:rows.length,excludedBalanceCents,rows};
}
export async function customerLifetimeSales(tenantId:string,locationId:string,asOf:Date){
 const tickets=await db.ticket.findMany({where:{tenantId,locationId,status:'CLOSED',closedAt:{lte:asOf}},select:{customerId:true,status:true,closedAt:true,customer:{select:{firstName:true,lastName:true,active:true}},lines:{select:{sourceKey:true,description:true,totalCents:true}}}});
 return customerSales(tickets,asOf);
}
