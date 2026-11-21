import {customerSales} from './report-calculations';
export {customerSales} from './report-calculations';
import {isGiftCardLine} from './gift-card-line';
import {db} from './db';

export async function customerLifetimeSales(tenantId:string,locationId:string,asOf:Date){
 const tickets=await db.ticket.findMany({where:{tenantId,locationId,status:'CLOSED',closedAt:{lte:asOf}},select:{customerId:true,status:true,closedAt:true,customer:{select:{firstName:true,lastName:true,active:true}},lines:{select:{sourceKey:true,description:true,totalCents:true}}}});
 return customerSales(tickets,asOf);
}
