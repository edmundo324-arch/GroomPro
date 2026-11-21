// Credit already collected on the customer account settles a ticket without
// creating a second cash/card collection.
export function ticketCreditCents(ticket:any){const value=Number(ticket.accountCreditCents||0);if(!Number.isSafeInteger(value)||value<0)throw Error('This ticket’s applied credit needs review before payment.');return value;}
export function ticketSettledCents(ticket:any){return (ticket.payments||[]).reduce((sum:number,p:any)=>sum+Math.round(Number(p.amount)*100),0)+ticketCreditCents(ticket);}
