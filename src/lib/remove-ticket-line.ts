import {packageKey} from './package-display';
import {removePackageLine,PackageRemovalChoice} from './package-removal';
import {ticketDuration} from './ticket-timing';
import {syncAppointmentPets} from './appointment-pet-store';
import {readLineStarts,writeLineStarts} from './line-time-store';
import {lineSchedule,scheduleBounds} from './pet-scheduling';
export async function removeTicketLine(tx:any,tenantId:string,ticketId:string,lineId:string,choice:PackageRemovalChoice|undefined,price:(serviceId:string)=>Promise<number|null>){
 await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticketId} AND tenantId=${tenantId} FOR UPDATE`;
 const ticket=await tx.ticket.findFirst({where:{id:ticketId,tenantId},include:{lines:{include:{service:true},orderBy:{sortOrder:'asc'}}}});
 if(!ticket||['CLOSED','CANCELLED','NO_SHOW'].includes(ticket.status))throw Error('This ticket is closed.');const removed=ticket.lines.find((l:any)=>l.id===lineId);if(!removed)throw Error('This service has already changed. Refresh the ticket.');if(removed.description==='Customer Account Balance')throw Error('Manage this balance through the customer account.');
 const key=packageKey(removed);if(key&&!choice)throw Object.assign(Error('Choose Keep Discount or Remove Discount before removing a package service.'),{packageRemovalRequired:true});
 const prices:Record<string,number>={};if(key&&choice==='REMOVE_DISCOUNT')for(const line of ticket.lines.filter((l:any)=>l.id!==lineId&&packageKey(l)===key)){const serviceId=line.serviceId;if(!serviceId)throw Error('This package service has no catalog price. Choose Keep Discount instead.');const regular=await price(serviceId);if(regular===null)throw Error('A regular service price is unavailable. Choose Keep Discount instead.');prices[serviceId]=regular;}
 const remaining=removePackageLine(ticket.lines,removed,choice||'KEEP_DISCOUNT',prices),changed=remaining.filter((l:any)=>{const old=ticket.lines.find((v:any)=>v.id===l.id);return old.unitPriceCents!==l.unitPriceCents||old.discountCents!==l.discountCents||old.totalCents!==l.totalCents});
 await tx.ticketLine.delete({where:{id:lineId}});for(const l of changed)await tx.ticketLine.update({where:{id:l.id},data:{unitPriceCents:l.unitPriceCents,discountCents:l.discountCents,totalCents:l.totalCents,commissionCents:l.commissionCents}});
 await syncAppointmentPets(tx,ticket,remaining);const times=await readLineStarts(tx,tenantId,ticketId),hadTimes=Object.keys(times).length>0;delete times[lineId];const timing=Object.keys(times).length?scheduleBounds({...ticket,lines:remaining},lineSchedule({...ticket,lines:remaining,lineStarts:times})):{durationMin:ticketDuration(remaining,ticket.timingMode)};
 if(hadTimes)await writeLineStarts(tx,tenantId,ticketId,times,{...ticket,lines:remaining});await tx.ticket.update({where:{id:ticketId},data:timing});return {removed,changed,remaining,priceChanges:changed.map((l:any)=>{const old=ticket.lines.find((v:any)=>v.id===l.id);return {lineId:l.id,before:{unitPriceCents:old.unitPriceCents,discountCents:old.discountCents,totalCents:old.totalCents,commissionCents:old.commissionCents},after:{unitPriceCents:l.unitPriceCents,discountCents:l.discountCents,totalCents:l.totalCents,commissionCents:l.commissionCents}}}),choice:choice||'KEEP_DISCOUNT'};
}
