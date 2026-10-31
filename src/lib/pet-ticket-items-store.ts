import {syncAppointmentPets} from './appointment-pet-store';
import {ticketDuration} from './ticket-timing';
// The caller owns the transaction. Snapshot IDs preserve items added after Remove was clicked.
export async function removePetTicketItems(tx:any,tenantId:string,ticketId:string,petId:string,lineIds:unknown){
 if(!ticketId||!petId||!Array.isArray(lineIds)||!lineIds.length||lineIds.length>2000||lineIds.some(id=>typeof id!=='string'||!id||id.length>128))throw Error('Choose a dog and the items to remove.');
 await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticketId} AND tenantId=${tenantId} FOR UPDATE`;
 const ticket=await tx.ticket.findFirst({where:{id:ticketId,tenantId},include:{pets:true,lines:{include:{service:true}},assignments:true}});
 if(!ticket)throw Error('Ticket could not be found.');
 if(['CLOSED','CANCELLED','NO_SHOW'].includes(ticket.status))throw Error('This ticket is closed.');
 if(!ticket.pets.some((p:any)=>p.petId===petId))throw Error('This dog is not on the ticket.');
 const ids=new Set(lineIds),removed=ticket.lines.filter((l:any)=>ids.has(l.id));
 if(removed.some((l:any)=>l.petId!==petId))throw Error('Remove can affect only the selected dog’s items.');
 if(removed.some((l:any)=>l.description==='Customer Account Balance'))throw Error('Manage this balance through the customer account.');
 const removedIds=removed.map((l:any)=>l.id),remaining=ticket.lines.filter((l:any)=>!removedIds.includes(l.id));
 if(removedIds.length)await tx.ticketLine.deleteMany({where:{ticketId,petId,id:{in:removedIds}}});
 await syncAppointmentPets(tx,ticket,remaining);
 const durationMin=ticketDuration(remaining,ticket.timingMode);
 await tx.ticket.update({where:{id:ticketId},data:{durationMin}});
 return {ticket,removed,remaining,durationMin};
}
