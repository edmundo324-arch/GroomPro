import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {db} from '@/src/lib/db';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {hidePlatformOwners,withRequestPolicy} from '@/src/lib/request-policy';
import {requestLocation} from '@/src/lib/request-location';
import {emptyClock,applyClock,type ClockState} from '@/src/lib/time-clock';
import {offlineCreateId} from '@/src/lib/offline-transaction';
const key=(id:string)=>'TIME_CLOCK:'+id;
async function handle(r:NextRequest){
 const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
 const session=await getActiveEmployeeSession(tenantId,r.cookies.get('groompro_session')?.value||'');if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 const canManage=['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role);
 if(r.method==='GET'){
  const employees=await db.user.findMany({where:{tenantId,...(!canManage?{id:session.user.id}:await hidePlatformOwners(r,tenantId)?{role:{not:'PLATFORM_OWNER' as const}}:{})},select:{id:true,firstName:true,lastName:true,displayName:true,active:true,locationId:true},orderBy:{lastName:'asc'}});
  const records=await db.tenantSetting.findMany({where:{tenantId,settingKey:{in:employees.map(e=>key(e.id))}}});
  const locations=await db.location.findMany({where:{tenantId},select:{id:true,name:true,timezone:true}});
  return NextResponse.json({locations,employeeId:session.user.id,canManage,employees,clocks:Object.fromEntries(employees.map(e=>[e.id,records.find(r=>r.settingKey===key(e.id))?.value||emptyClock()]))},{headers:{'Cache-Control':'no-store'}});
 }
 try{
  const b=await r.json(),userId=b.action==='CORRECT'?String(b.userId||''):session.user.id;
  if(b.action==='CORRECT'&&!canManage)return NextResponse.json({error:'Ask a manager to correct this time record.'},{status:403});
  if(!await db.user.findFirst({where:{id:userId,tenantId}}))throw Error('Employee not found.');
  const locationId=await requestLocation(r,tenantId);if(!locationId)throw Error('Choose the shop location.');
  let offline=false;try{offline=!!r.headers.get('x-groompro-offline')&&!JSON.parse(decodeURIComponent(r.headers.get('x-groompro-offline')||'')).live}catch{}
  const at=offline?String(b.at||''):new Date().toISOString();if(+new Date(at)>Date.now()+300000)throw Error('This device time is ahead of the shop. Correct the device clock before syncing.');
  const result=await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
   const where={tenantId_settingKey:{tenantId,settingKey:key(userId)}},row=await tx.tenantSetting.findUnique({where}),previous=(row?.value as unknown as ClockState)||emptyClock();
   const clock=applyClock(previous,b,at,offlineCreateId()||randomUUID(),locationId,offline);
   await tx.tenantSetting.upsert({where,create:{tenantId,settingKey:key(userId),value:clock as any},update:{value:clock as any}});
   await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'USER',entityId:userId,action:'TIME_CLOCK_'+b.action,summary:b.action==='CORRECT'?'Corrected employee time with a recorded reason.':'Recorded employee time.',details:{reason:String(b.reason||'').slice(0,2000),at,offline,previousRevision:previous.revision,...(b.action==='CORRECT'?{previous:previous.shifts.find(s=>s.id===b.shiftId),corrected:clock.shifts.find(s=>s.id===b.shiftId)}:{})}}});
   return clock;
  });return NextResponse.json({clock:result,userId});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:409});}
}
export const GET=withRequestPolicy(handle,{feature:'CALENDAR'});
export const POST=withRequestPolicy(handle,{feature:'CALENDAR'});
