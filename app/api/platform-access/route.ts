import {NextRequest,NextResponse} from 'next/server';
import {requestAuthorization} from '@/src/lib/request-authorization';
import {platformSession,isPlatformAdmin} from '@/src/lib/platform-access';
import {platformAccessKey} from '@/src/lib/platform-restrictions';
import {db} from '@/src/lib/db';
import {saveWithPin} from '@/src/lib/employee-pin-assignment';
import {GROOMPRO_ROLES} from '@/src/lib/roles';
import {reconcileEmployeeAssignments} from '@/src/lib/groomer-assignment';

// Only the explicit Developer role may manage access across businesses.
async function handle(r:NextRequest){
 const actor=await platformSession(r);
 if(!actor)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 if(!isPlatformAdmin(actor))return NextResponse.json({error:'GroomPro developer access is required.'},{status:403});
 if(r.method==='GET'){
  const tenantId=r.nextUrl.searchParams.get('tenantId');
  const tenants=await db.tenant.findMany({select:{id:true,name:true},orderBy:{name:'asc'}});
  if(!tenantId)return NextResponse.json({tenants});
  const employees=await db.user.findMany({where:{tenantId},select:{id:true,firstName:true,lastName:true,displayName:true,role:true,active:true}});
  const row=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:platformAccessKey}}});
  return NextResponse.json({tenants,employees,access:row?.value||{suspended:false,blockedUserIds:[]}});
 }
 try{
  const b=await r.json(),tenantId=String(b.tenantId||''),reason=String(b.reason||'').trim();
  if(!reason||reason.length>1000)throw Error('Enter a short reason for this access change.');
  if(!await db.tenant.findUnique({where:{id:tenantId}}))throw Error('Business not found.');
  await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  if(b.action==='EMPLOYEE'){
   const employee=await tx.user.findFirst({where:{tenantId,id:String(b.userId||'')}});
   if(!employee)throw Error('Employee not found.');
   if(employee.id===actor.user.id&&(b.role!=='DEVELOPER'||!b.active))throw Error('Another Developer must change your Developer authority.');
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
