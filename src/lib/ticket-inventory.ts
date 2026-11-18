import type {Prisma} from '@prisma/client';

// Called only inside the checkout transaction, after locking and checking the ticket.
export async function subtractTicketStock(tx:Prisma.TransactionClient, tenantId:string, ticket:{id:string;customerId:string;orderNumber:number;lines:{lineType:string;productId:string|null;description:string;quantity:number}[]}, actorUserId:string){
 const quantities=new Map<string,number>(), warnings:string[]=[];
 for(const line of ticket.lines){
  if(line.lineType!=='PRODUCT')continue;
  if(!line.productId||!Number.isSafeInteger(line.quantity)||line.quantity<=0){warnings.push(`${line.description}: stock was not changed because this item has no linked product or valid quantity. Review it in Inventory.`);continue;}
  quantities.set(line.productId,(quantities.get(line.productId)||0)+line.quantity);
 }
 // Consistent lock order prevents two multi-product sales from deadlocking.
 for(const id of [...quantities.keys()].sort()){
  const rows=await tx.$queryRaw<{id:string;name:string;quantity:number}[]>`SELECT id,name,quantity FROM Product WHERE id=${id} AND tenantId=${tenantId} FOR UPDATE`;
  const product=rows[0], sold=quantities.get(id)!;
  if(!product){warnings.push('A sold product is no longer available in Inventory. Its stock was not changed; review the ticket’s merchandise.');continue;}
  const before=product.quantity, after=Math.max(0,before-sold), shortage=Math.max(0,sold-before);
  await tx.product.updateMany({where:{id,tenantId},data:{quantity:after}});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId,entityType:'INVENTORY_ITEM',entityId:id,customerId:ticket.customerId,action:'TICKET_STOCK_SALE',summary:`Ticket #${ticket.orderNumber}: sold ${sold} ${product.name}; ${after} remaining.`,details:{ticketId:ticket.id,sold,before,after,shortage}}});
  if(shortage)warnings.push(`${product.name}: sold ${sold}, but only ${before} were recorded in stock. Stock is now 0. Check the count in Inventory (${shortage} short).`);
 }
 if(warnings.length)await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId,entityType:'TICKET',entityId:ticket.id,customerId:ticket.customerId,action:'INVENTORY_WARNING',summary:'Ticket closed with inventory items to review.',details:{warnings}}});
 return warnings;
}
