// OPEN remains the stored pre-confirmation state; customer-facing wording is Accepted.
export function ticketStatusLabel(ticket:{status?:string;displayStatus?:string|null;bookingDecision?:string}){
 if(ticket.displayStatus)return ticket.displayStatus;
 if(ticket.status==='OPEN'||!ticket.status)return ['REQUESTED','PENDING'].includes(ticket.bookingDecision||'')?'Requested':'Accepted';
 return ticket.status.replaceAll('_',' ');
}
