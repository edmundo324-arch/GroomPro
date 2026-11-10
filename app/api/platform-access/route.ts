import {NextRequest,NextResponse} from 'next/server';
import {requestAuthorization} from '@/src/lib/request-authorization';
import {platformSession,isPlatformAdmin} from '@/src/lib/platform-access';
import {platformAccessKey} from '@/src/lib/platform-restrictions';
import {db} from '@/src/lib/db';
import {saveWithPin} from '@/src/lib/employee-pin-assignment';
import {GROOMPRO_ROLES,canManageRole} from '@/src/lib/roles';
import {reconcileEmployeeAssignments} from '@/src/lib/groomer-assignment';
import {businessCookie,businessId,contextCookieOptions,deviceCookie,platformUserPrefix,sessionCookie} from '@/src/lib/business-context';
import {businessOwnerInput,businessOwnerKey,currentBusinessSession,openBusinessSession,pilotBusinessInput,platformHome,saveBusinessOwner} from '@/src/lib/platform-business';

// Only explicit Platform Owner and Developer roles may manage access across businesses.
async function handle(r:NextRequest){
 const actor=await platformSession(r);
 if(!actor)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 if(!isPlatformAdmin(actor))return NextResponse.json({error:'GroomPro developer access is required.'},{status:403});
 if(r.method==='GET'){
  const tenantId=r.nextUrl.searchParams.get('tenantId');
  const tenants=await db.tenant.findMany({select:{id:true,name:true},orderBy:{name:'asc'}});
  const currentTenantId=actor.tenantId;
  const canReturnHome=businessId(currentTenantId)&&actor.user.id.startsWith(platformUserPrefix);
  if(!tenantId)return NextResponse.json({tenants,currentTenantId,canReturnHome,canManageOwners:actor.user.role==='PLATFORM_OWNER'});
  const employees=await db.user.findMany({where:{tenantId},select:{id:true,firstName:true,lastName:true,displayName:true,role:true,active:true}});
  const rows=await db.tenantSetting.findMany({where:{tenantId,settingKey:{in:[platformAccessKey,businessOwnerKey]}}});
  const access=rows.find(row=>row.settingKey===platformAccessKey)?.value;
  const owner=rows.find(row=>row.settingKey===businessOwnerKey)?.value as {userId?:string}|undefined;
  return NextResponse.json({tenants,employees,currentTenantId,canReturnHome,businessOwnerId:owner?.userId,canManageOwners:actor.user.role==='PLATFORM_OWNER',access:access||{suspended:false,blockedUserIds:[]}});
 }
 try{
  const b=await r.json(),tenantId=String(b.tenantId||''),reason=String(b.reason||'').trim();
  if(b.action==='CREATE_BUSINESS'){
   const input=pilotBusinessInput(b);
   const owner=businessOwnerInput(b.owner);
   const tenant=await db.$transaction(async tx=>{
    const home=await platformHome(tx,actor.user);
    if(!home)throw Error('Platform Owner or Developer access is required.');
    if(await tx.tenant.findFirst({where:{name:input.name},select:{id:true}}))throw Error('A business with that name already exists.');
    const created=await tx.tenant.create({data:{id:input.id,name:input.name,locations:{create:{name:input.location,timezone:input.timezone}}},select:{id:true,name:true,locations:{select:{id:true}}}});
    await saveBusinessOwner(tx,created.id,created.locations[0].id,owner);
    await tx.auditEntry.create({data:{tenantId:created.id,actorType:'EMPLOYEE',actorUserId:home.id,entityType:'TENANT',entityId:created.id,action:'PLATFORM_BUSINESS_CREATE',summary:'Created a separate business workspace.'}});
    return {id:created.id,name:created.name};
   });
   return NextResponse.json({tenant},{status:201});
  }
  if(b.action==='ADD_BUSINESS_OWNER'){
   const owner=businessOwnerInput(b.owner);
   if(!businessId(tenantId))throw Error('Choose a business created through this setup.');
   await db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
    if(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:businessOwnerKey}}}))throw Error('This business already has an owner.');
    const location=await tx.location.findFirst({where:{tenantId},orderBy:{createdAt:'asc'},select:{id:true}});
    if(!location)throw Error('This business needs a location.');
    const userId=await saveBusinessOwner(tx,tenantId,location.id,owner);
    await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:actor.user.id,entityType:'USER',entityId:userId,action:'BUSINESS_OWNER_CREATE',summary:'Added the first business owner.'}});
   });
   return NextResponse.json({ok:true},{status:201});
  }
  if(b.action==='OPEN_BUSINESS'||b.action==='RETURN_HOME'){
   const deviceId=r.cookies.get(deviceCookie)?.value;
   if(!deviceId||deviceId!==actor.deviceId)throw Error('Sign in again on this device.');
   const returning=b.action==='RETURN_HOME';
   const {tenant,session}=await db.$transaction(async tx=>{
    const operator=returning?await currentBusinessSession(tx,actor.tenantId,actor.id,deviceId):actor;
    if(!operator||!isPlatformAdmin(operator))throw Error('Sign in again on this device.');
    return openBusinessSession(tx,operator.user,operator.id,returning?null:tenantId,deviceId);
   });
   const response=NextResponse.json({tenant});
   const options=contextCookieOptions();
   response.cookies.set(businessCookie,tenant.id,{...options,maxAge:60*60*24*30});
   response.cookies.set(sessionCookie,session.id,{...options,maxAge:60*60*12});
   return response;
  }
  if(!reason||reason.length>1000)throw Error('Enter a short reason for this access change.');
  if(!await db.tenant.findUnique({where:{id:tenantId}}))throw Error('Business not found.');
  await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  if(b.action==='EMPLOYEE'){
   const employee=await tx.user.findFirst({where:{tenantId,id:String(b.userId||'')}});
   if(!employee)throw Error('Employee not found.');
   if(!canManageRole(actor.user.role,employee.role)||!canManageRole(actor.user.role,b.role))throw Error('Only a Platform Owner can change Owner access.');
   if(employee.id===actor.user.id&&(b.role!==employee.role||!b.active))throw Error('Another authorized platform administrator must change your own authority.');
   if(!GROOMPRO_ROLES.includes(b.role)||typeof b.active!=='boolean')throw Error('Choose a role and access status.');
   const data={role:b.role,active:b.active};
   if(b.pin)await saveWithPin(tenantId,String(b.pin),employee.id,data,tx);else await tx.user.update({where:{id:employee.id},data});
   await tx.employeeSession.updateMany({where:{tenantId,userId:employee.id,endedAt:null},data:{endedAt:new Date()}});
  }else if(b.action!=='BUSINESS'||typeof b.suspended!=='boolean')throw Error('Choose a valid access change.');
   const old=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:platformAccessKey}}});
   const before=(old?.value||{}) as any;const blocked=new Set<string>(before.blockedUserIds||[]);
   if(b.action==='EMPLOYEE'){if(b.active)blocked.delete(b.userId);else blocked.add(b.userId)}
   const value={...before,suspended:b.action==='BUSINESS'?b.suspended:!!before.suspended,blockedUserIds:[...blocked]};
   await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey:platformAccessKey}},create:{tenantId,settingKey:platformAccessKey,value},update:{value}});
   await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:actor.user.id,entityType:'TENANT',entityId:tenantId,action:'PLATFORM_ACCESS',summary:reason,details:{developerTenantId:actor.tenantId,action:b.action,userId:b.userId||null,role:b.role||null,pinChanged:!!b.pin,before,after:value}}});
  },{timeout:30000});
  if(b.action==='EMPLOYEE')await reconcileEmployeeAssignments(tenantId);
  return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}
}
export const GET=(r:NextRequest)=>requestAuthorization.run(new Map(),()=>handle(r));
export const PATCH=(r:NextRequest)=>requestAuthorization.run(new Map(),()=>handle(r));
