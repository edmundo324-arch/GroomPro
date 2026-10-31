import {lineSchedule} from '@/src/lib/pet-scheduling';
import {lineStartsKey} from '@/src/lib/line-time-store';
import {attendingPets} from '@/src/lib/appointment-pets';
import {plannedSettingKey} from '@/src/lib/planned-package-store';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {customerStates} from '@/src/lib/appointment-customer-state';
import {groomingSummary} from '@/src/lib/grooming-notes-rules';
import {calendarBlocks} from '@/src/lib/calendar-blocks';
import {reconcileEmployeeAssignments} from '@/src/lib/groomer-assignment';
import {NextRequest,NextResponse} from "next/server";
import {db} from "@/src/lib/db";
import {requestLocation} from "@/src/lib/request-location";
export const dynamic="force-dynamic";
async function handlePolicyGET(request:NextRequest){
 const start=new Date(request.nextUrl.searchParams.get("start")||""),end=new Date(request.nextUrl.searchParams.get("end")||"");
 if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start||+end-+start>32*86400000)return NextResponse.json({error:"A valid calendar range of up to 31 days is required."},{status:400});
 const tenantId=request.headers.get("x-tenant-id")||request.cookies.get("groompro_tenant")?.value||process.env.GROOMPRO_DEV_TENANT_ID||"";
 if(!tenantId)return NextResponse.json({error:"Business context is required."},{status:401});
 try{
 const locationId=await requestLocation(request,tenantId);
 if(!locationId)return NextResponse.json({error:"Select a location for this calendar."},{status:400});
 const ticketId=request.nextUrl.searchParams.get('ticketId')||undefined;
 await reconcileEmployeeAssignments(tenantId,{locationId,start,end,ticketId});
 const dayKeys:string[]=[];for(let stamp=+start-86400000;stamp<=+end+86400000;stamp+=86400000)dayKeys.push('CALENDAR_DATE:'+locationId+':'+new Date(stamp).toISOString().slice(0,10)+':');
 const indexes=await db.tenantSetting.findMany({where:{tenantId,OR:dayKeys.map(prefix=>({settingKey:{startsWith:prefix}}))},select:{value:true}}),extraIds=indexes.map(r=>(r.value as any)?.ticketId).filter((id):id is string=>typeof id==='string');
 const[employees,tickets,assets,employeeSchedules,assetSchedules]=await Promise.all([
 ticketId?Promise.resolve([]):db.user.findMany({where:{tenantId,active:true,OR:[{locationId},{locationId:null}]},select:{id:true,displayName:true,firstName:true,lastName:true,role:true,active:true},orderBy:[{lastName:"asc"},{firstName:"asc"}]}),
 db.ticket.findMany({where:{tenantId,locationId,...(ticketId?{id:ticketId}:{}),...(extraIds.length?{OR:[{scheduledStart:{gte:start,lt:end}},{id:{in:extraIds}}]}:{scheduledStart:{gte:start,lt:end}}),status:{not:"CANCELLED"}},include:{customer:{select:{firstName:true,lastName:true,_count:{select:{tickets:{where:{status:"CLOSED"}}}}}},pets:{include:{pet:{select:{id:true,name:true,breed:true,weightLbs:true,vipEligible:true,notes:true,groomingNotes:true}}}},lines:{select:{id:true,lineType:true,serviceId:true,description:true,packageName:true,packageId:true,packageGroupKey:true,totalCents:true,durationMin:true,quantity:true,service:{select:{durationMin:true}},petId:true,assignmentUnavailable:true,role:true,assignedUserId:true},orderBy:{sortOrder:"asc"}},assignments:{where:{role:{in:['GROOMER','PLANNED_GROOMER']}},include:{user:{select:{displayName:true,id:true,firstName:true,lastName:true}}}}},orderBy:{scheduledStart:"asc"}}),
 ticketId?Promise.resolve([]):db.$queryRaw<any[]>`SELECT id,name,category,active FROM BookingAsset WHERE tenantId=${tenantId} AND locationId=${locationId} AND active=1 ORDER BY category,name`,
 ticketId?Promise.resolve([]):db.$queryRaw<any[]>`SELECT s.userId,s.dayOfWeek,s.startTime,s.endTime FROM EmployeeSchedule s JOIN User u ON u.id=s.userId WHERE s.tenantId=${tenantId} AND (u.locationId=${locationId} OR u.locationId IS NULL) AND s.active=1`,
 ticketId?Promise.resolve([]):db.$queryRaw<any[]>`SELECT s.assetId,s.dayOfWeek,s.startTime,s.endTime FROM BookingAssetSchedule s JOIN BookingAsset a ON a.id=s.assetId WHERE a.tenantId=${tenantId} AND a.locationId=${locationId} AND s.active=1`
 ]);
 const plannedRows=await db.tenantSetting.findMany({where:{tenantId,settingKey:{in:tickets.map(t=>plannedSettingKey(t.id))}}});const plans=new Map(plannedRows.map(r=>[r.settingKey,(r.value as any)?.items||[]]));
 const timeRows=await db.tenantSetting.findMany({where:{tenantId,settingKey:{in:tickets.map(t=>lineStartsKey(t.id))}}}),times=new Map(timeRows.map(r=>[r.settingKey,r.value]));
 const grooming=await db.groomingNote.findMany({where:{tenantId,ticketId:{in:tickets.map(t=>t.id)}},select:{ticketId:true,petId:true,instructions:true}});
 const scheduleOverrides=ticketId?[]:await db.scheduleOverride.findMany({where:{tenantId,date:{gte:new Date(+start-86400000).toISOString().slice(0,10),lte:new Date(+end+86400000).toISOString().slice(0,10)}}});
 return NextResponse.json({blocks:ticketId?undefined:await calendarBlocks(tenantId,locationId),employees,tickets:(await customerStates(tenantId,tickets)).map(t=>({...t,legacyPlannedUserId:t.assignments.find((a:any)=>a.role==='PLANNED_GROOMER')?.user.id||null,assignments:t.assignments.filter((a:any)=>a.role==='GROOMER'),lineStarts:lineSchedule({...t,lineStarts:times.get(lineStartsKey(t.id)) as any||{}}),plannedAssignments:plans.get(plannedSettingKey(t.id))||[],pets:attendingPets(t).pets.map((p:any)=>({...p,pet:{...p.pet,todaysGroomingNotes:groomingSummary(grooming.find(n=>n.ticketId===t.id&&n.petId===p.pet.id)?.instructions)}})),needsAssignment:t.lines.some((l:any)=>l.assignmentUnavailable&&l.role==='GROOM')})),assets,employeeSchedules,assetSchedules,scheduleOverrides,locationId},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("Calendar load failed",error);return NextResponse.json({error:"Calendar could not load. Retry to see your appointments."},{status:503})}
}


export const GET=withRequestPolicy(handlePolicyGET, {feature:'CALENDAR'});
