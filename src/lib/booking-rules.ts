import {workflowSettings} from './workflow-settings';
import { db } from "./db";

export type BookingConflict = {
  type: "OVERLAP" | "RECENT";
  orderNumber: number;
  scheduledStart: Date;
  petNames: string[];
  message: string;
};

export async function checkCustomerBookingRules(tenantId:string,customerId:string,start:Date,durationMin:number,petIds?:string[],excludeId?:string){
 const settings=await workflowSettings(tenantId);if(!settings.bookingWarnings)return {conflicts:[],hardOverlap:false};
 const days=settings.warningDays, end=new Date(+start+durationMin*60000);
 const tickets=await db.ticket.findMany({
  where:{tenantId,customerId,...(excludeId?{id:{not:excludeId}}:{}),scheduledStart:{not:null},status:{notIn:['CANCELLED','NO_SHOW']}},
  select:{scheduledStart:true,durationMin:true,orderNumber:true,pets:{select:{petId:true,pet:{select:{name:true}}}}},
 });
 const conflicts:BookingConflict[]=[];
 let nearestPet:typeof tickets[number]|undefined,nearestHousehold:typeof tickets[number]|undefined;
 function gap(ticket:typeof tickets[number]){return Math.abs(+ticket.scheduledStart!-+start)}
 function add(ticket:typeof tickets[number],type:BookingConflict['type'],message:string){
  if(!ticket.scheduledStart||conflicts.some(row=>row.orderNumber===ticket.orderNumber))return;
  const petNames=ticket.pets.map(p=>p.pet.name);
  conflicts.push({type,orderNumber:ticket.orderNumber,scheduledStart:ticket.scheduledStart,petNames,
   message:message+` Order #${ticket.orderNumber} · ${petNames.join(', ')} · ${ticket.scheduledStart.toISOString().slice(0,10)}.`});
 }
 for(const ticket of tickets){
  if(!ticket.scheduledStart)continue;
  const same=!petIds?.length||ticket.pets.some(p=>petIds.includes(p.petId));
  if(settings.warningScope==='PET'&&!same)continue;
  if(ticket.scheduledStart<end&&+ticket.scheduledStart+ticket.durationMin*60000>+start){
   add(ticket,'OVERLAP','This appointment overlaps another visit.');
  }
  if(same&&(!nearestPet||gap(ticket)<gap(nearestPet)))nearestPet=ticket;
  if(!nearestHousehold||gap(ticket)<gap(nearestHousehold))nearestHousehold=ticket;
 }
 if(settings.warningScope!=='HOUSEHOLD'&&nearestPet&&gap(nearestPet)>days*86400000){
  add(nearestPet,'RECENT',settings.warningPetMessage==='This pet has another nearby appointment.'
   ?`This pet’s closest appointment is more than ${days} days away.`:settings.warningPetMessage);
 }
 if(settings.warningScope!=='PET'&&nearestHousehold&&gap(nearestHousehold)>days*86400000){
  add(nearestHousehold,'RECENT',settings.warningHouseholdMessage==='Another pet in this household has a nearby appointment.'
   ?`This household’s closest appointment is more than ${days} days away.`:settings.warningHouseholdMessage);
 }
 return {conflicts,hardOverlap:conflicts.some(c=>c.type==='OVERLAP')};
}

export async function getOnlineBookingRules(tenantId: string, locationId: string) {
  return db.onlineBookingRule.findMany({ where: { tenantId, locationId, enabled: true }, orderBy: { category: "asc" } });
}
