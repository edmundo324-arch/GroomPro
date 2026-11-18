export function currentReceivables(customers:any[],tickets:any[],asOf:Date){
 const accounts=customers.map(c=>({id:c.id,name:[c.firstName,c.lastName].filter(Boolean).join(' '),active:c.active,balanceCents:c.balanceCents,creditCents:c.creditCents}));
 const openTickets=tickets.map(t=>{
  const totalCents=(t.lines||[]).reduce((n:number,l:any)=>n+l.totalCents,0)+(t.tipCents||0)+(t.salesTaxCents||0),paidCents=(t.payments||[]).reduce((n:number,p:any)=>n+Math.round(Number(p.amount)*100),0);
  return {id:t.id,orderNumber:t.orderNumber,customerId:t.customerId,name:[t.customer?.firstName,t.customer?.lastName].filter(Boolean).join(' '),scheduledStart:t.scheduledStart,status:t.status,totalCents,paidCents,dueCents:Math.max(0,totalCents-paidCents)};
 }).filter(t=>t.dueCents>0);
 return {asOf:asOf.toISOString(),accounts,openTickets,accountBalanceCents:accounts.reduce((n,c)=>n+c.balanceCents,0),accountCreditCents:accounts.reduce((n,c)=>n+c.creditCents,0),openTicketDueCents:openTickets.reduce((n,t)=>n+t.dueCents,0)};
}
