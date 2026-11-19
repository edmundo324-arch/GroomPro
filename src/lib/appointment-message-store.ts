import {db} from './db';
import {appointmentMessagePolicy,defaultAppointmentMessagePolicy,type AppointmentMessagePolicy} from './appointment-message-policy';
export const appointmentMessageKey='APPOINTMENT_MESSAGE_POLICY';
export async function readAppointmentMessageSettings(tenantId:string,client:any=db){
 const row=await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:appointmentMessageKey}}});
 const value=row?.value as any;
 return {revision:value?.revision||0,policy:value?appointmentMessagePolicy(value.policy):defaultAppointmentMessagePolicy,activeSince:value?.activeSince||null};
}
export async function saveAppointmentMessageSettings(tenantId:string,userId:string,revision:number,input:unknown){
 const policy:AppointmentMessagePolicy=appointmentMessagePolicy(input);
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  const previous=await readAppointmentMessageSettings(tenantId,tx);
  if(previous.revision!==revision)throw Error('Another person changed the message rules. Your edits are still here; reopen this section to review the saved version.');
  const value={revision:revision+1,policy,activeSince:policy.enabled?previous.policy.enabled&&previous.activeSince?previous.activeSince:new Date().toISOString():null};
  const where={tenantId_settingKey:{tenantId,settingKey:appointmentMessageKey}};
  await tx.tenantSetting.upsert({where,create:{tenantId,settingKey:appointmentMessageKey,value},update:{value}});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:userId,entityType:'TENANT',entityId:tenantId,action:'APPOINTMENT_MESSAGE_POLICY',summary:'Updated appointment message schedules and wording.',details:{revision:value.revision,enabled:policy.enabled}}});
  return value;
 });
}

// Establish one activation boundary before a scheduled worker considers existing bookings.
// Reading Settings alone must not advance this boundary or start a new schedule.
export async function initializeAppointmentMessageSettings(tenantId:string){
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  const current=await readAppointmentMessageSettings(tenantId,tx);
  if(current.revision||current.activeSince)return current;
  const value={...current,revision:1,activeSince:new Date().toISOString()};
  const where={tenantId_settingKey:{tenantId,settingKey:appointmentMessageKey}};
  await tx.tenantSetting.upsert({where,create:{tenantId,settingKey:appointmentMessageKey,value},update:{value}});
  return value;
 });
}
