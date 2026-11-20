// Use saved ticket tax, never allocate an open-ticket deposit to tax.
export function closedTicketTax(tickets:any[]){const rows=tickets.filter(t=>t.status==='CLOSED'&&t.closedAt).map(t=>({id:t.id,ticketNumber:t.orderNumber,closedAt:new Date(t.closedAt).toISOString(),taxCents:Number(t.salesTaxCents)||0}));return {rows,tickets:rows.length,taxCents:rows.reduce((sum,r)=>sum+r.taxCents,0)};}
