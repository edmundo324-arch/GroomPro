import {inventorySnapshot,soldProductCosts} from './report-calculations';
export {inventorySnapshot,soldProductCosts} from './report-calculations';
import {isGiftCardLine} from './gift-card-line';
import {db} from './db';

export async function currentInventoryReport(tenantId:string,asOf=new Date()){
 return inventorySnapshot(await db.product.findMany({where:{tenantId},select:{id:true,name:true,sku:true,active:true,quantity:true,costCents:true,priceCents:true},orderBy:{name:'asc'}}),asOf);
}


export async function productCostReport(tenantId:string,closed:any[]){
 const tickets=closed.filter(t=>t.lines.some((l:any)=>l.lineType==='PRODUCT'));
 const audits=tickets.length?await db.auditEntry.findMany({where:{tenantId,action:'TICKET_STOCK_SALE',OR:tickets.map(t=>({details:{path:'$.ticketId',equals:t.id}}))},select:{entityId:true,details:true}}):[];
 return soldProductCosts(tickets,audits);
}
