import {accountChanges} from './report-calculations';
export {accountChanges} from './report-calculations';
import {db} from './db';
import {Prisma} from '@prisma/client';

export async function accountChangesReport(tenantId:string,start:Date,end:Date){
 const customers=await db.customer.findMany({where:{tenantId},select:{id:true,firstName:true,lastName:true}});
 const entries=customers.length?await db.$queryRaw<any[]>`SELECT id,customerId,entryType,amountCents,reason,ticketId,createdAt FROM CustomerAccountLedger WHERE tenantId=${tenantId} AND customerId IN (${Prisma.join(customers.map(c=>c.id))}) AND createdAt>=${start} AND createdAt<${end}`:[];
 return accountChanges(customers,entries,start,end);
}
