import {bookedPetIds} from './appointment-pets';
// Only the current appointment links change. Pet records, notes and prior visits are retained.
export async function syncAppointmentPets(tx:any,ticket:{id:string;tenantId:string;customerId:string},lines:any[]){
 const ids=bookedPetIds(lines);
 const pets=ids.length?await tx.pet.findMany({where:{id:{in:ids},tenantId:ticket.tenantId,customerId:ticket.customerId},select:{id:true}}):[];
 if(pets.length!==ids.length)throw Error('Appointment items must belong to this customer’s dogs.');
 await tx.ticketPet.deleteMany({where:{ticketId:ticket.id,...(ids.length?{petId:{notIn:ids}}:{})}});
 for(const petId of ids)await tx.ticketPet.upsert({where:{ticketId_petId:{ticketId:ticket.id,petId}},create:{ticketId:ticket.id,petId},update:{}});
}
