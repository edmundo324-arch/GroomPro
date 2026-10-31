import {packageKey} from './package-display';
import {db} from './db';
import {employeeAvailable} from './groomer-assignment';
import {schedulingException} from './scheduling-warning';
import {validatePlannedPackages,PlannedPackage,plannedFor} from './planned-package-rules';
import {workflowSettings} from './workflow-settings';
import {ticketWorkspace} from './pos-layout';
export const plannedSettingKey=(id:string)=>'TICKET_PLANNED_PACKAGES:'+id;
export async function readPlannedPackages(tenantId:string,ticketId:string,client:any=db):Promise<PlannedPackage[]>{const row=await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:plannedSettingKey(ticketId)}}});return Array.isArray(row?.value?.items)?row.value.items:[];}
export async function checkPlannedPackages(tenantId:string,ticket:any,value:any,allowUnavailable=false,client:any=db){
 const settings=ticketWorkspace((await workflowSettings(tenantId,client)).posLayout),plans=validatePlannedPackages(value,ticket.pets.map((p:any)=>p.petId||p.pet.id),ticket.lines,settings.individualPackageAssignments);
 for(const userId of new Set(plans.map(p=>p.userId).filter((id):id is string=>!!id))){if(!await client.user.findFirst({where:{id:userId,tenantId,active:true,OR:[{locationId:ticket.locationId},{locationId:null}]}}))throw Error('Choose an active employee at this location.');if(ticket.scheduledStart&&!allowUnavailable&&!await employeeAvailable(tenantId,userId,ticket.locationId,new Date(ticket.scheduledStart),ticket.durationMin))throw schedulingException('This employee is unavailable for this appointment. Choose another employee or Assign later.');}
 return plans;
}
export async function writePlannedPackages(client:any,tenantId:string,ticketId:string,items:PlannedPackage[],ticket?:any,previous:PlannedPackage[]=[]){
 if(ticket){const petIds=ticket.pets.map((p:any)=>p.petId||p.pet.id),legacy=previous.length?null:ticket.assignments?.find((a:any)=>a.role==='PLANNED_GROOMER')?.userId||ticket.assignments?.find((a:any)=>a.role==='GROOMER')?.userId||null;items=items.filter(p=>petIds.includes(p.petId));for(const petId of petIds)if(!items.some(p=>p.petId===petId&&!p.packageKey))items.push({petId,userId:legacy});
 // Keep the existing appointment/Calendar index compatible; actual line employees are untouched.
 if(!ticket.checkedInAt){const users=new Set<string>((ticket.lines||[]).filter((l:any)=>l.petId&&l.lineType!=='PRODUCT').map((l:any)=>plannedFor(ticket.lines,items,l.petId,packageKey(l),legacy||'')).filter(Boolean));await client.ticketAssignment.deleteMany({where:{ticketId,role:{in:['GROOMER','PLANNED_GROOMER']}}});for(const userId of users)await client.ticketAssignment.createMany({data:[{ticketId,userId,role:'GROOMER'},{ticketId,userId,role:'PLANNED_GROOMER'}]});}}
 const settingKey=plannedSettingKey(ticketId),value={items};await client.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey}},create:{tenantId,settingKey,value},update:{value}});
}

