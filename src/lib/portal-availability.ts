import {db} from './db';
import {employeeOnlineKey} from './online-booking-resources';
import {calendarBlocks} from './calendar-blocks';
import {locationHours} from './location-hours';
import {localToInstant,zonedParts,hoursError} from './operating-hours';
import {petServiceType} from './calendar-presentation';
import {resolveSaleLines,type SaleInput} from './pos-lines';
import {ticketDuration,timingMode} from './ticket-timing';
import {workflowSettings} from './workflow-settings';
import {readPortalPolicy} from './portal-policy-store';
export function portalBookingError(message:string){return Object.assign(new Error(message),{name:'PortalError'});}
export type PortalPetSelection={petId:string;itemKey:string};
export async function portalSelections(tenantId:string,locationId:string,customerId:string,selections:PortalPetSelection[],client:any=db){
 if(!Array.isArray(selections)||!selections.length||selections.length>100||selections.some(s=>!s||typeof s.petId!=='string'||!s.petId||typeof s.itemKey!=='string')||new Set(selections.map(s=>s.petId)).size!==selections.length)throw portalBookingError('Choose each dog once and select a service or package for that dog.');
 const policy=await readPortalPolicy(tenantId,client),inputs:SaleInput[]=[];
 for(const {petId,itemKey} of selections){
  if(!policy.bookableItems.includes(itemKey))throw portalBookingError('One of these services is not offered online. Ask the shop to help book it.');
  const pet=await client.pet.findFirst({where:{tenantId,customerId,id:petId,active:true}});if(!pet)throw portalBookingError('Choose only your active dogs. A dog’s profile may have changed; refresh your details.');
  const [type,id]=itemKey.split(':');inputs.push({type:type as SaleInput['type'],id,petId,quantity:1});
 }
 const petIds=selections.map(s=>s.petId),resolved=await resolveSaleLines(client,tenantId,inputs,petIds,locationId);
 const mode=timingMode((await workflowSettings(tenantId,client)).timingMode),duration=ticketDuration(resolved.lines,mode);
 if(duration<=0)throw portalBookingError('The shop needs to set these services’ durations before they can be booked online.');
 return {policy,inputs,petIds,lines:resolved.lines,duration,serviceType:petServiceType({lines:resolved.lines},petIds[0])};
}
export async function portalSelection(tenantId:string,locationId:string,customerId:string,petId:string,itemKey:string,client:any=db){
 const selected=await portalSelections(tenantId,locationId,customerId,[{petId,itemKey}],client);return {...selected,input:selected.inputs[0]};
}
export async function portalAvailability(tenantId:string,locationId:string,date:string,duration:number,serviceType:string,client:any=db,customerId?:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw portalBookingError('Choose a valid date.');
 const hours=await locationHours(tenantId,locationId),zone=hours.timezone;
 const dayStart=localToInstant(date+'T00:00',zone),nextDate=new Date(Date.parse(date+'T12:00:00Z')+86400000).toISOString().slice(0,10),dayEnd=localToInstant(nextDate+'T00:00',zone);
 const [employees,opted,assets,shifts,assetShifts,overrides,blocks,busy]=await Promise.all([
  client.user.findMany({where:{tenantId,active:true,OR:[{locationId},{locationId:null}]},select:{id:true,firstName:true,lastName:true,displayName:true,role:true,jobTitle:true}}),
  client.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:'EMPLOYEE_AVAILABLE_ONLINE:'}},select:{settingKey:true,value:true}}),
  client.$queryRaw`SELECT id,name,category FROM BookingAsset WHERE tenantId=${tenantId} AND locationId=${locationId} AND active=1 AND onlineBookingRecipient=1`,
  client.$queryRaw`SELECT userId AS resourceId,dayOfWeek,startTime,endTime FROM EmployeeSchedule WHERE tenantId=${tenantId} AND active=1`,
  client.$queryRaw`SELECT s.assetId AS resourceId,s.dayOfWeek,s.startTime,s.endTime FROM BookingAssetSchedule s JOIN BookingAsset a ON a.id=s.assetId WHERE a.tenantId=${tenantId} AND a.locationId=${locationId} AND s.active=1`,
  client.scheduleOverride.findMany({where:{tenantId,date}}),calendarBlocks(tenantId,locationId,client),
  client.$queryRaw`SELECT t.id,t.customerId,t.scheduledStart,t.durationMin,t.bookingAssetId,a.userId,l.assignedUserId FROM Ticket t LEFT JOIN TicketAssignment a ON a.ticketId=t.id LEFT JOIN TicketLine l ON l.ticketId=t.id WHERE t.tenantId=${tenantId} AND (t.locationId=${locationId} OR t.customerId=${customerId||''}) AND t.status NOT IN ('CANCELLED','CLOSED','NO_SHOW') AND t.scheduledStart<${dayEnd} AND DATE_ADD(t.scheduledStart,INTERVAL t.durationMin MINUTE)>${dayStart}`
 ]);
 const resources=[...employees.filter((e:any)=>opted.some((o:any)=>o.settingKey===employeeOnlineKey(e.id)&&o.value===true)).map((e:any)=>({id:e.id,kind:'employee',name:e.displayName||[e.firstName,e.lastName].filter(Boolean).join(' ')})),...assets.map((a:any)=>({id:a.id,kind:'asset',name:a.name}))];
 const special=hours.specialHours.find(h=>h.date===date),weekday=new Date(date+'T12:00:00Z').getUTCDay(),effective=special?hours.hours.map(h=>h.day===weekday?{...h,...special}:h):hours.hours;
 function available(start:Date,customerId?:string){
  const end=new Date(+start+duration*60000),a=zonedParts(start,zone),b=zonedParts(end,zone);
  if(+start<=Date.now()||a.date!==date||b.date!==date||hoursError(start,duration,effective,zone))return [];
  const overlap=(row:any)=>+new Date(row.scheduledStart)<+end&&+new Date(row.scheduledStart)+row.durationMin*60000>+start;
  if(customerId&&busy.some((row:any)=>row.customerId===customerId&&overlap(row)))return [];
  return resources.filter((resource:any)=>{
   const override=overrides.find((o:any)=>o.resourceKind===resource.kind&&o.resourceId===resource.id);
   const windows=override?(override.dayOff?[]:[override]):(resource.kind==='employee'?shifts:assetShifts).filter((s:any)=>s.resourceId===resource.id&&Number(s.dayOfWeek)===weekday);
   if(!windows.some((w:any)=>w.startTime&&w.endTime&&a.time>=w.startTime&&b.time<=w.endTime))return false;
   if(blocks.some(block=>block.resourceKind===resource.kind&&block.resourceId===resource.id&&+new Date(block.start)<+end&&+new Date(block.end)>+start))return false;
   return !busy.some((row:any)=>overlap(row)&&(resource.kind==='asset'?row.bookingAssetId===resource.id:row.userId===resource.id||row.assignedUserId===resource.id));
  });
 }
 return {zone,available};
}
