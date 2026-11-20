import {isGiftCardLine} from './gift-card-line';
export function reportSummary(tickets:any[],payments:any[],closed:any[],memberships:any[],referrals:any[],start:Date,end:Date){
 const sum=(rows:any[],fn:(x:any)=>number)=>rows.reduce((n,x)=>n+fn(x),0);
 const services=new Map<string,{id:string;name:string;amountCents:number;quantity:number}>(),employees=new Map<string,{id:string;name:string;amountCents:number}>();
 for(const ticket of closed)for(const line of ticket.lines||[]){
  if(line.lineType==='SERVICE'){const key=line.serviceId||line.description;const value=services.get(key)||{id:key,name:line.service?.name||line.description,amountCents:0,quantity:0};value.amountCents+=line.totalCents;value.quantity+=line.quantity;services.set(key,value);}
  if(line.assignedUserId){const u=line.assignedUser;const value=employees.get(line.assignedUserId)||{id:line.assignedUserId,name:u?.displayName||[u?.firstName,u?.lastName].filter(Boolean).join(' ')||'Former employee',amountCents:0};value.amountCents+=line.commissionCents||0;employees.set(line.assignedUserId,value);}
 }
 const inPeriod=(date:any)=>date&&+new Date(date)>=+start&&+new Date(date)<+end;
 const referralCounts:Record<string,number>={};for(const r of referrals){const source=r.source||'Not recorded';referralCounts[source]=(referralCounts[source]||0)+1;}
 return {appointments:tickets.length,projectedSalesCents:sum(tickets,t=>(t.totalCents||sum(t.lines||[],l=>l.totalCents))-sum((t.lines||[]).filter(isGiftCardLine),l=>l.totalCents)),statusCounts:tickets.reduce((out,t)=>({...out,[t.status]:(out[t.status]||0)+1}),{} as Record<string,number>),collectedCents:sum(payments,p=>Math.round(Number(p.amount)*100)),closedSalesCents:sum(closed,t=>sum((t.lines||[]).filter((l:any)=>!isGiftCardLine(l)),l=>l.totalCents)),tipsCents:sum(closed,t=>t.tipCents||0),serviceSales:[...services.values()],commissions:[...employees.values()],membershipStarts:memberships.filter(m=>inPeriod(m.startedAt)).length,membershipEnds:memberships.filter(m=>inPeriod(m.endedAt)).length,currentMembershipStatuses:memberships.reduce((out,m)=>({...out,[m.status]:(out[m.status]||0)+1}),{} as Record<string,number>),referrals:referralCounts};
}
