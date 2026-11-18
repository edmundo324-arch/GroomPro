import {NextRequest,NextResponse} from 'next/server';
import {withRequestPolicy,hidePlatformOwners} from '@/src/lib/request-policy';
import {authorizeSchedule} from '@/src/lib/schedule-access';
import {scheduleSnapshot} from '@/src/lib/offline-schedule-store';
import {db} from '@/src/lib/db';
async function get(r:NextRequest){
 const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
 const denied=await authorizeSchedule(r,tenantId);if(denied)return denied;
 const data=await scheduleSnapshot(tenantId);
 if(await hidePlatformOwners(r,tenantId)){const owners=new Set((await db.user.findMany({where:{tenantId,role:'PLATFORM_OWNER'},select:{id:true}})).map(u=>u.id));data.schedules=data.schedules.filter((s:any)=>!owners.has(s.userId));data.overrides=data.overrides.filter((s:any)=>s.resourceKind!=='employee'||!owners.has(s.resourceId));}
 return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
}
export const GET=withRequestPolicy(get,{feature:'CALENDAR'});
