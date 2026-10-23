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
 const days=settings.warningDays,end=new Date(+start+durationMin*60000);
 const tickets=await db.ticket.findMany({where:{tenantId,customerId,...(excludeId?{id:{not:excludeId}}:{}),scheduledStart:{gte:new Date(+start-days*86400000),lte:new Date(+end+days*86400000)},status:{notIn:['CANCELLED','NO_SHOW']}},include:{pets:{include:{pet:{select:{name:true}}}}},orderBy:{scheduledStart:'asc'}});
 const conflicts:BookingConflict[]=[];
 for(const t of tickets){if(!t.scheduledStart)continue;const same=!petIds||t.pets.some(p=>petIds.includes(p.petId));if(settings.warningScope==='PET'&&!same)continue;const overlap=t.scheduledStart<end&&+t.scheduledStart+t.durationMin*60000>+start;if(!overlap&&Math.abs(+t.scheduledStart-+start)>days*86400000)continue;
 conflicts.push({type:overlap?'OVERLAP':'RECENT',orderNumber:t.orderNumber,scheduledStart:t.scheduledStart,petNames:t.pets.map(p=>p.pet.name),message:(same&&settings.warningScope!=='HOUSEHOLD'?settings.warningPetMessage:settings.warningHouseholdMessage)+` Order #${t.orderNumber} · ${t.pets.map(p=>p.pet.name).join(', ')} · ${t.scheduledStart.toISOString().slice(0,10)}.`});}
 return {conflicts,hardOverlap:conflicts.some(c=>c.type==='OVERLAP')};
}

export async function getOnlineBookingRules(tenantId: string, locationId: string) {
  return db.onlineBookingRule.findMany({ where: { tenantId, locationId, enabled: true }, orderBy: { category: "asc" } });
}
