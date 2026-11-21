import {ticketSettledCents} from './ticket-settlement';
export function currentReceivables(customers:any[],tickets:any[],asOf:Date){
 const accounts=customers.map(c=>({id:c.id,name:[c.firstName,c.lastName].filter(Boolean).join(' '),active:c.active,balanceCents:c.balanceCents,creditCents:c.creditCents,nextAppointment:(()=>{const t=tickets.filter(t=>t.customerId===c.id&&t.scheduledStart&&+new Date(t.scheduledStart)>=+asOf&&!['REQUESTED','PENDING'].includes(t.bookingDecision)).sort((a,b)=>+new Date(a.scheduledStart)-+new Date(b.scheduledStart))[0];return t?{id:t.id,orderNumber:t.orderNumber,scheduledStart:t.scheduledStart}:null})()}));
 const openTickets=tickets.map(t=>{
  const totalCents=(t.lines||[]).reduce((n:number,l:any)=>n+l.totalCents,0)+(t.tipCents||0)+(t.salesTaxCents||0),paidCents=ticketSettledCents(t);
  return {id:t.id,orderNumber:t.orderNumber,customerId:t.customerId,name:[t.customer?.firstName,t.customer?.lastName].filter(Boolean).join(' '),scheduledStart:t.scheduledStart,status:t.status,carriedBalanceCents:(t.lines||[]).filter((l:any)=>l.description==='Customer Account Balance').reduce((n:number,l:any)=>n+l.totalCents,0),totalCents,paidCents,dueCents:Math.max(0,totalCents-paidCents)};
 }).filter(t=>t.dueCents>0);
 return {asOf:asOf.toISOString(),accounts,openTickets,accountBalanceCents:accounts.reduce((n,c)=>n+c.balanceCents,0),accountCreditCents:accounts.reduce((n,c)=>n+c.creditCents,0),openTicketDueCents:openTickets.reduce((n,t)=>n+t.dueCents,0)};
}
