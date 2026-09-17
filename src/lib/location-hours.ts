import {db} from "./db";
import {defaultHours,hoursError,parseHours} from "./operating-hours";
export async function locationHours(tenantId:string,locationId:string){
 const location=await db.location.findFirst({where:{id:locationId,tenantId},select:{id:true,name:true,timezone:true}});if(!location)throw new Error("Location not found.");
 const setting=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:`OPERATING_HOURS:${locationId}`}}});
 return{locationId,locationName:location.name,timezone:location.timezone||"America/Chicago",hours:setting?parseHours(setting.value):defaultHours()};
}
export async function appointmentHoursError(tenantId:string,locationId:string,start:Date,durationMin:number){const h=await locationHours(tenantId,locationId);return hoursError(start,durationMin,h.hours,h.timezone)}

