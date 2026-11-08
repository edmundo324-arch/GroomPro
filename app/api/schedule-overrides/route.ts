import {authorizeSchedule} from '@/src/lib/schedule-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {reconcileEmployeeAssignments} from '@/src/lib/groomer-assignment';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {dateRange,parseDate,validShift,selectedScheduleDates} from '@/src/lib/schedule-dates';
const tenant=(r:NextRequest)=>r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
async function handlePolicyGET(r:NextRequest){const tenantId=tenant(r);if(!tenantId)return NextResponse.json({error:'Business context is required.'},{status:401});try{const start=r.nextUrl.searchParams.get('start')||'',end=r.nextUrl.searchParams.get('end')||'';dateRange(start,end);return NextResponse.json({overrides:await db.scheduleOverride.findMany({where:{tenantId,date:{gte:start,lte:end}}})},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'Could not load date-specific schedules. Choose a valid date range.'},{status:400})}}
async function save(r:NextRequest){const tenantId=tenant(r);if(!tenantId)return NextResponse.json({error:'Business context is required.'},{status:401});const denied=await authorizeSchedule(r,tenantId);if(denied)return denied;try{const b=await r.json(),resourceId=String(b.resourceId||''),resourceKind=String(b.resourceKind||''),date=String(b.date||b.startDate||'');parseDate(date);const dates=b.startDate?selectedScheduleDates(String(b.startDate),String(b.endDate),b.weekdays):[date];if(!['employee','asset'].includes(resourceKind)||!resourceId)throw Error('Choose an employee or booking asset.');const exists=resourceKind==='employee'?await db.user.findFirst({where:{id:resourceId,tenantId}}):(await db.$queryRaw<{id:string}[]>`SELECT id FROM BookingAsset WHERE id=${resourceId} AND tenantId=${tenantId} LIMIT 1`)[0];if(!exists)return NextResponse.json({error:'Employee or asset not found.'},{status:404});const where={tenantId_resourceKind_resourceId_date:{tenantId,resourceKind,resourceId,date}};if(r.method==='DELETE'){await db.scheduleOverride.deleteMany({where:{tenantId,resourceKind,resourceId,date}});await reconcileEmployeeAssignments(tenantId);return NextResponse.json({ok:true})}if(typeof b.dayOff!=='boolean')throw Error('Choose working or off.');const start=String(b.startTime||''),end=String(b.endTime||'');if(!b.dayOff&&!validShift(start,end))throw Error('Enter valid hours with start before end.');const data={dayOff:b.dayOff,startTime:b.dayOff?null:start,endTime:b.dayOff?null:end};const sick=b.absence==='SICK';
 if(sick&&(resourceKind!=='employee'||!b.dayOff||dates.length!==1))throw Error('A sick call applies to one employee and date.');
 const sid=r.cookies.get('groompro_session')?.value||'';
 const actor=sick?await getActiveEmployeeSession(tenantId,sid):null;
 if(sick&&!actor)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 await db.$transaction(async tx=>{
  for(const day of dates)await tx.scheduleOverride.upsert({where:{tenantId_resourceKind_resourceId_date:{tenantId,resourceKind,resourceId,date:day}},create:{tenantId,resourceKind,resourceId,date:day,...data},update:data});
  if(actor)await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:actor.user.id,entityType:'USER',entityId:resourceId,action:'CALLED_IN_SICK',summary:'Marked an employee off for a sick call.',details:{date}}});
 });
 await reconcileEmployeeAssignments(tenantId);return NextResponse.json({ok:true})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not save schedule.'},{status:400})}}
const handlePolicyPUT=save;const handlePolicyDELETE=save;

export const GET=withRequestPolicy(handlePolicyGET, {});
export const PUT=withRequestPolicy(handlePolicyPUT, {});
export const DELETE=withRequestPolicy(handlePolicyDELETE, {});
