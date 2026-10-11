// Caller holds the tenant row lock. Draft reservations remain even after promotion.
export async function nextTicketNumber(tx:any,tenantId:string){
 const [tickets,drafts]=await Promise.all([tx.ticket.aggregate({where:{tenantId},_max:{orderNumber:true}}),tx.posDraft.aggregate({where:{tenantId},_max:{orderNumber:true}})]);
 return Math.max(tickets._max.orderNumber||0,drafts._max.orderNumber||0)+1;
}
