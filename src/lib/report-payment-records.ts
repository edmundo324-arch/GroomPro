export function paymentRecords(payments:any[]){
 const rows=payments.map(p=>({id:String(p.id),ticketId:String(p.ticketId),ticketNumber:p.ticket?.orderNumber??null,paidAt:new Date(p.paidAt).toISOString(),method:String(p.paymentType).replace(/_/g,' '),amountCents:Math.round(Number(p.amount)*100)})).sort((a,b)=>a.paidAt.localeCompare(b.paidAt)||a.id.localeCompare(b.id));
 return {rows,count:rows.length,amountCents:rows.reduce((sum,r)=>sum+r.amountCents,0)};
}
