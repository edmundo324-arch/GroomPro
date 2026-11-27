import {NextRequest,NextResponse} from 'next/server';
import {saveTimeClock} from '@/src/lib/save-time-clock';
import {db} from '@/src/lib/db';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {hidePlatformOwners,withRequestPolicy} from '@/src/lib/request-policy';
import {requestLocation} from '@/src/lib/request-location';
import {emptyClock} from '@/src/lib/time-clock';
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
  const result=await saveTimeClock(tenantId,userId,session.user.id,locationId,b,at,offline);return NextResponse.json({clock:result,userId});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:409});}
}
export const GET=withRequestPolicy(handle,{feature:'CALENDAR'});
export const POST=withRequestPolicy(handle,{feature:'CALENDAR'});
