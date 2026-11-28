// Both POS and calendar use the same shop/day allocator for older check-ins.
export async function repairArrivalOrder(id:string){
 const response=await fetch('/api/tickets/status',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId:id,status:'CHECKED_IN',action:'REPAIR_ARRIVAL'})});
 if(!response.ok)return null;
 const {ticket}=await response.json();
 if(ticket?.id!==id||!ticket.arrivalPriority)return null;
 window.dispatchEvent(new CustomEvent('groompro:arrival-repaired',{detail:{ticketId:id,arrivalPriority:ticket.arrivalPriority,locationId:ticket.locationId,tenantId:ticket.tenantId}}));
 return Number(ticket.arrivalPriority);
}
