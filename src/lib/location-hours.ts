import {parseSpecialHours} from './grooming-notes-rules';
import {zonedParts} from './operating-hours';
import {db} from "./db";
import {defaultHours,hoursError,parseHours} from "./operating-hours";
export async function locationHours(tenantId:string,locationId:string){
 const location=await db.location.findFirst({where:{id:locationId,tenantId},select:{id:true,name:true,timezone:true}});if(!location)throw new Error("Location not found.");
 const setting=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:`OPERATING_HOURS:${locationId}`}}});
 const special=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:`SPECIAL_HOURS:${locationId}`}}});
 return{specialHours:special?parseSpecialHours(special.value):[],locationId,locationName:location.name,timezone:location.timezone||"America/Chicago",hours:setting?parseHours(setting.value):defaultHours()};
}
export async function appointmentHoursError(tenantId:string,locationId:string,start:Date,durationMin:number){const rule=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'WORKFLOW'}},select:{value:true}});
 if((rule?.value as {enforceBusinessHours?:boolean}|null)?.enforceBusinessHours===false)return null;
 const h=await locationHours(tenantId,locationId);const date=zonedParts(start,h.timezone).date,special=h.specialHours.find(x=>x.date===date);const message=hoursError(start,durationMin,special?h.hours.map(d=>d.day===new Date(date+"T12:00:00Z").getUTCDay()?{...d,...special}:d):h.hours,h.timezone);return message?.startsWith("Appointments")?"OUTSIDE BUSINESS HOURS: "+message:message}

