import {withRequestPolicy} from '@/src/lib/request-policy';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {calendarBlocks} from '@/src/lib/calendar-blocks';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {requestLocation} from '@/src/lib/request-location';
import {writeAudit} from '@/src/lib/audit';
async function handlePolicyPOST(r:NextRequest){
 const tenantId=r.headers.get('x-tenant-id')||process.env.GROOMPRO_DEV_TENANT_ID||'',locationId=await requestLocation(r,tenantId),sid=r.cookies.get('groompro_session')?.value;
 const session=tenantId&&sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 if(!['DEVELOPER','ADMIN','MANAGER','FLOOR_MANAGER','FRONT'].includes(session.user.role))return NextResponse.json({error:'Manager access required.'},{status:403});
 if(!locationId)return NextResponse.json({error:'Select a location.'},{status:400});
 try{
 const b=await r.json();if(!/^[a-zA-Z0-9-]{16,80}$/.test(b.id||''))throw Error('A valid block ID is required.');
 if(!b.remove){if(!['employee','asset'].includes(b.resourceKind)||!b.resourceId||!Number.isFinite(+new Date(b.start))||!Number.isFinite(+new Date(b.end))||+new Date(b.end)<=+new Date(b.start))throw Error('Choose a resource and valid start and end times.');
 const found=b.resourceKind==='employee'?await db.user.findFirst({where:{id:b.resourceId,tenantId,active:true,OR:[{locationId},{locationId:null}]}}):(await db.$queryRaw<any[]>`SELECT id FROM BookingAsset WHERE id=${b.resourceId} AND tenantId=${tenantId} AND locationId=${locationId} AND active=1`)[0];if(!found)throw Error('This resource is unavailable.');}
 const blocks=await db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM Location WHERE id=${locationId} AND tenantId=${tenantId} FOR UPDATE`;
 const list=await calendarBlocks(tenantId,locationId,tx),old=list.find(x=>x.id===b.id);
 if(old&&b.revision!==old.revision)throw Error('This block changed elsewhere. Refresh before editing.');
 if(!old&&b.revision)throw Error('This block was removed elsewhere.');
 const next=list.filter(x=>x.id!==b.id);if(!b.remove)next.push({id:b.id,resourceKind:b.resourceKind,resourceId:b.resourceId,start:new Date(b.start).toISOString(),end:new Date(b.end).toISOString(),label:String(b.label||'Time block').slice(0,100),revision:(old?.revision||0)+1});
 await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey:`CALENDAR_BLOCKS:${locationId}`}},create:{tenantId,settingKey:`CALENDAR_BLOCKS:${locationId}`,value:next},update:{value:next}});return next;
 });
 await writeAudit({tenantId,actorUserId:session.user.id,entityType:'TENANT',entityId:locationId,action:'CALENDAR_BLOCK',summary:b.remove?'Removed availability block.':'Updated availability block.',details:{blockId:b.id}});
 return NextResponse.json({blocks});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:409})}
}

export const POST=withRequestPolicy(handlePolicyPOST, {feature:'CALENDAR'});
