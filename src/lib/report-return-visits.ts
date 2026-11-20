import {zonedParts} from './operating-hours';
export function returnVisitCohorts(customers:any[],tickets:any[],weeks:number,asOf:Date,start:Date,end:Date,timezone:string){
 const allowed=new Set(customers.map(c=>c.id)),visits=new Map<string,Set<string>>(),today=zonedParts(asOf,timezone).date,from=zonedParts(start,timezone).date,through=zonedParts(new Date(+end-1),timezone).date;
 for(const t of tickets){if(!allowed.has(t.customerId)||t.status!=='CLOSED'||!t.closedAt||!t.lines?.some((l:any)=>l.lineType==='SERVICE'&&l.petId&&['GROOM','BATH','PREP','DRY'].includes(l.role)))continue;const at=new Date(t.closedAt);if(!Number.isFinite(+at)||at>asOf)continue;const days=visits.get(t.customerId)||new Set<string>();days.add(zonedParts(at,timezone).date);visits.set(t.customerId,days);}
 const groups=new Map<string,{month:string;customers:number;eligible:number;returned:number;waiting:number}>();
 for(const days of visits.values()){const dates=[...days].sort(),first=dates[0];if(first<from||first>through)continue;const month=first.slice(0,7),row=groups.get(month)||{month,customers:0,eligible:0,returned:0,waiting:0};row.customers++;
 const deadline=new Date(first+'T12:00:00Z');deadline.setUTCDate(deadline.getUTCDate()+weeks*7);const due=deadline.toISOString().slice(0,10);
 if(due>=today)row.waiting++;else{row.eligible++;if(dates[1]&&dates[1]<=due)row.returned++;}groups.set(month,row);
 }
 return {weeks,asOf:asOf.toISOString(),rows:[...groups.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(r=>({...r,rate:r.eligible?100*r.returned/r.eligible:null}))};
}
