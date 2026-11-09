import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { businessId, businessPrefix } from './business-context';
import { isPlatformRole } from './roles';
import { platformAccessKey } from './platform-restrictions';

const platformUserPrefix='pilot_operator_';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex').slice(0,40);

export function pilotBusinessInput(input:any) {
  const name=typeof input?.name==='string'?input.name.trim().replace(/\s+/g,' '):'';
  const location=typeof input?.location==='string'?input.location.trim().replace(/\s+/g,' '):'';
  const timezone=typeof input?.timezone==='string'?input.timezone.trim():'';
  if (!name || name.length>100 || !location || location.length>100) throw Error('Enter a business name and location name.');
  try { if(!timezone)throw Error();new Intl.DateTimeFormat('en-US',{timeZone:timezone}); } catch { throw Error('Enter a valid time zone, such as America/Chicago.'); }
  return {id:businessPrefix+hash(name.toLowerCase()),name,location,timezone};
}

type Operator={id:string;tenantId:string;role:string;importSourceId?:string|null};
export async function platformHome(tx:Prisma.TransactionClient,user:Operator) {
  if(!isPlatformRole(user.role)) return null;
  const linked=user.id.startsWith(platformUserPrefix);
  const home=await tx.user.findUnique({where:{id:linked?user.importSourceId||'':user.id}});
  if(!home?.active||!isPlatformRole(home.role)||home.id.startsWith(platformUserPrefix))return null;
  if(linked&&user.id!==platformUserPrefix+hash(user.tenantId+':'+home.id))return null;
  const restriction=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:home.tenantId,settingKey:platformAccessKey}},select:{value:true}});
  const access=restriction?.value as {blockedUserIds?:string[]}|null;
  if(access?.blockedUserIds?.includes(home.id))return null;
  return home;
}

export async function openBusinessSession(tx:Prisma.TransactionClient, actor:Operator, fromSession:string, tenantId:string, deviceId:string) {
  const home=await platformHome(tx,actor);
  if(!home)throw Error('Platform Owner or Developer access is required.');
  if(tenantId!==home.tenantId&&!businessId(tenantId))throw Error('Choose a pilot business or your home business.');
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  const tenant=await tx.tenant.findUnique({where:{id:tenantId},select:{id:true,name:true,locations:{select:{id:true},orderBy:{createdAt:'asc'},take:1}}});
  if(!tenant?.locations[0])throw Error('This business needs a location before it can open.');
  const previous=await tx.employeeSession.updateMany({where:{id:fromSession,tenantId:actor.tenantId,deviceId,endedAt:null},data:{endedAt:new Date()}});
  if(!previous.count)throw Error('Your employee session changed. Sign in again.');
  let userId=home.id;
  if(tenantId!==home.tenantId){
    userId=platformUserPrefix+hash(tenantId+':'+home.id);
    const profile={firstName:home.firstName,lastName:home.lastName,displayName:home.displayName,role:home.role};
    const existing=await tx.user.findUnique({where:{id:userId}});
    if(existing&&(!existing.active||existing.tenantId!==tenantId||existing.importSourceId!==home.id))throw Error('Your access to this business is disabled.');
    await tx.user.upsert({where:{id:userId},create:{...profile,id:userId,tenantId,importSourceId:home.id,pinHash:'IMPORT_DISABLED'},update:profile});
  }
  await tx.employeeSession.updateMany({where:{tenantId,deviceId,endedAt:null},data:{endedAt:new Date()}});
  const session=await tx.employeeSession.create({data:{tenantId,userId,deviceId}});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:userId,entityType:'TENANT',entityId:tenantId,action:'PLATFORM_BUSINESS_OPEN',summary:'Opened this business workspace.',details:{homeTenantId:home.tenantId,homeUserId:home.id}}});
  return {session,tenant};
}

export async function currentBusinessSession(tx:Prisma.TransactionClient,tenantId:string,sessionId:string,deviceId:string) {
  if(!sessionId||!deviceId)return null;
  const session=await tx.employeeSession.findFirst({where:{id:sessionId,tenantId,deviceId,endedAt:null,user:{active:true}},include:{user:{select:{id:true,tenantId:true,role:true,importSourceId:true}}}});
  if(!session||session.user.tenantId!==tenantId)return null;
  const rows=await tx.tenantSetting.findMany({where:{tenantId,settingKey:{in:['WORKFLOW',platformAccessKey]}},select:{settingKey:true,value:true}});
  const rules=rows.find(r=>r.settingKey==='WORKFLOW')?.value as {inactivityMinutes?:number}|undefined;
  const access=rows.find(r=>r.settingKey===platformAccessKey)?.value as {suspended?:boolean;blockedUserIds?:string[]}|undefined;
  if(Date.now()-+session.lastActiveAt>(rules?.inactivityMinutes??30)*60000||access?.blockedUserIds?.includes(session.user.id))return null;
  if(session.user.id.startsWith(platformUserPrefix)){
    const home=await platformHome(tx,session.user);
    if(!home||home.role!==session.user.role)return null;
  }
  if(access?.suspended&&!isPlatformRole(session.user.role))return null;
  return session;
}
