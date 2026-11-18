import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {portalPolicy} from '@/src/lib/cancellation-policy';
import {portalPolicyKey,readPortalPolicy} from '@/src/lib/portal-policy-store';
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function handle(r:NextRequest){
 const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
 const sid=r.cookies.get('groompro_session')?.value;
 const session=sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return reply({error:'Enter your employee PIN.'},401);
 if(!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role))return reply({error:'An owner or manager can change the customer portal rules.'},403);
 if(r.method==='GET'){const [services,packages,locations]=await Promise.all([db.service.findMany({where:{tenantId,active:true},select:{id:true,name:true}}),db.package.findMany({where:{tenantId,active:true},select:{id:true,name:true}}),db.location.findMany({where:{tenantId},select:{id:true,name:true}})]);return reply({policy:await readPortalPolicy(tenantId),tenantId,locations,catalog:[...services.map(s=>({...s,key:'SERVICE:'+s.id})),...packages.map(s=>({...s,key:'PACKAGE:'+s.id}))]});}
 try{
  const body=await r.json(),policy=portalPolicy(body.policy);
  await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
   const previous=await readPortalPolicy(tenantId,tx);
   if(JSON.stringify(previous)!==JSON.stringify(body.previous))throw Error('Another person changed these rules. Reopen this section before saving.');
   await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey:portalPolicyKey}},create:{tenantId,settingKey:portalPolicyKey,value:policy},update:{value:policy}});
   await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'TENANT',entityId:tenantId,action:'PORTAL_POLICY',summary:'Updated customer portal booking and cancellation rules.'}});
  });
  return reply({policy});
 }catch(e){return reply({error:e instanceof Error?e.message:'Could not save the portal rules. Try again.'},400);}
}
export const GET=withRequestPolicy(handle,{configure:true});
export const PUT=withRequestPolicy(handle,{configure:true});
