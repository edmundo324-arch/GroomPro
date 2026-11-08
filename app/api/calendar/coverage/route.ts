import {Prisma} from '@prisma/client';
import {NextRequest,NextResponse} from 'next/server';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {requestLocation} from '@/src/lib/request-location';
import {db} from '@/src/lib/db';
import {employeeName} from '@/src/lib/employee-name';
import {workflowSettings} from '@/src/lib/workflow-settings';
import {ticketWorkspace} from '@/src/lib/pos-layout';
import {coverageManagerRoles,coverageQualified,coverageRanges,type CoverageRange} from '@/src/lib/calendar-coverage';
import {localToInstant,zonedParts} from '@/src/lib/operating-hours';
import {dateKey,parseDate,shiftDate} from '@/src/lib/schedule-dates';
import {calendarBlocks} from '@/src/lib/calendar-blocks';
import {lineStartsKey} from '@/src/lib/line-time-store';
import {lineSchedule,lineTimeKey,petSchedule,responsibleEmployee} from '@/src/lib/pet-scheduling';
import {isRequestLine,petServiceType,petServiceTypesKey} from '@/src/lib/calendar-presentation';
import {packageKey} from '@/src/lib/package-display';
import {plannedFor,plannedKey,type PlannedPackage} from '@/src/lib/planned-package-rules';
import {plannedSettingKey,writePlannedPackages} from '@/src/lib/planned-package-store';

const activeStatuses=['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY'] as const;
type Proposal={ticketId:string;petId:string;packageKey?:string;pet:string;type:string;start:string;employeeId:string;employee:string;reason?:string};

async function review(request:NextRequest){
 const session=await platformSession(request);
 if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 if(!coverageManagerRoles.includes(session.user.role))return NextResponse.json({error:'Manager access is required.'},{status:403});
 const {tenantId}=session,locationId=await requestLocation(request,tenantId);
 try{
  const body=await request.json(),range=body.range as CoverageRange,sickId=typeof body.employeeId==='string'?body.employeeId:'';
  if(!Object.hasOwn(coverageRanges,range)||sickId&&range!=='day')throw Error('Choose a valid coverage range.');
  const location=await db.location.findFirst({where:{tenantId,id:locationId}});
  if(!location)throw Error('Select a Calendar location.');
  const zone=location.timezone||'America/Chicago',today=zonedParts(new Date(),zone).date;
  const selected=parseDate(body.date||today);
  let first=dateKey(selected),through:string|undefined=shiftDate(first,1);
  if(!sickId){
   if(range==='week')through=shiftDate(first,7);
   if(range==='month'){first=dateKey(new Date(selected.getFullYear(),selected.getMonth(),1,12));through=dateKey(new Date(selected.getFullYear(),selected.getMonth()+1,1,12));}
   if(range==='upcoming'){first=today;through=undefined;}
  }
  const start=localToInstant(first+'T00:00',zone),end=through?localToInstant(through+'T00:00',zone):undefined;
  const apply=request.method==='PUT';
  const result=await db.$transaction(async tx=>{
   if(apply)await tx.$queryRaw`SELECT id FROM Location WHERE id=${locationId} AND tenantId=${tenantId} FOR UPDATE`;
   const policy=ticketWorkspace((await workflowSettings(tenantId,tx)).posLayout);
   if(!sickId&&!policy.coverageRanges.includes(range))throw Error('This coverage range is disabled in Settings.');
   const indexed=await tx.tenantSetting.findMany({where:{tenantId,settingKey:{gte:'CALENDAR_DATE:'+locationId+':'+first,lt:'CALENDAR_DATE:'+locationId+':'+(through||'9999')}},select:{value:true}});
   const indexedIds=indexed.flatMap(row=>{const id=(row.value as {ticketId?:string}|null)?.ticketId;return id?[id]:[]});
   const [tickets,employees,shifts,overrides,blocks]=await Promise.all([
    tx.ticket.findMany({where:{tenantId,locationId,status:{in:[...activeStatuses]},OR:[{scheduledStart:{gte:new Date(+start-86400000),lt:end}},{id:{in:indexedIds}}]},include:{pets:{include:{pet:{select:{id:true,name:true}}}},lines:{include:{service:{select:{name:true,code:true,category:true,durationMin:true,customFields:true}}},orderBy:{sortOrder:'asc'}},assignments:true},orderBy:[{scheduledStart:'asc'},{id:'asc'}]}),
    tx.user.findMany({where:{tenantId,active:true,OR:[{locationId},{locationId:null}]},orderBy:[{lastName:'asc'},{firstName:'asc'},{id:'asc'}]}),
    tx.$queryRaw<{userId:string;dayOfWeek:number;startTime:string;endTime:string}[]>`SELECT userId,dayOfWeek,startTime,endTime FROM EmployeeSchedule WHERE tenantId=${tenantId} AND active=1`,
    tx.scheduleOverride.findMany({where:{tenantId,resourceKind:'employee',date:{gte:shiftDate(first,-1),lt:through}}}),
    calendarBlocks(tenantId,locationId,tx)
   ]);
   const rows=await tx.tenantSetting.findMany({where:{tenantId,settingKey:{in:tickets.flatMap(t=>[plannedSettingKey(t.id),lineStartsKey(t.id),petServiceTypesKey(t.id)])}}});
   const settings=new Map(rows.map(row=>[row.settingKey,row.value]));
   const employeeIds=new Set(employees.map(e=>e.id));
   const slots=new Map<string,Array<{start:number;end:number}>>();
   const reserve=(id:string,from:number,to:number)=>slots.set(id,[...(slots.get(id)||[]),{start:from,end:to}]);
   const working=(id:string,from:number,to:number)=>{
    if(!employeeIds.has(id))return false;
    const a=zonedParts(new Date(from),zone),b=zonedParts(new Date(to),zone);
    if(a.date!==b.date)return false;
    const special=overrides.find(o=>o.resourceId===id&&o.date===a.date);
    const hours=special?(special.dayOff?[]:[special]):shifts.filter(s=>s.userId===id&&Number(s.dayOfWeek)===parseDate(a.date).getDay());
    return hours.some(h=>h.startTime&&h.endTime&&a.time>=h.startTime&&b.time<=h.endTime)
      &&!blocks.some(block=>block.resourceKind==='employee'&&block.resourceId===id&&+new Date(block.start)<to&&+new Date(block.end)>from);
   };
   const candidates:Array<{row:Proposal;from:number;to:number;serviceCategories:string[]}>=[];
   for(const ticket of tickets){
    const plans=(settings.get(plannedSettingKey(ticket.id)) as {items?:PlannedPackage[]})?.items||[];
    const legacy=plans.length?'':ticket.assignments.find(a=>a.role==='PLANNED_GROOMER')?.userId||ticket.assignments.find(a=>a.role==='GROOMER')?.userId||'';
    const full={...ticket,lineStarts:(settings.get(lineStartsKey(ticket.id))||{}) as Record<string,string>,petServiceTypes:settings.get(petServiceTypesKey(ticket.id))};
    const starts=lineSchedule(full);
    for(const line of ticket.lines){
     if(!line.assignedUserId||!starts[lineTimeKey(line)])continue;
     const from=+new Date(starts[lineTimeKey(line)]);
     reserve(line.assignedUserId,from,from+Math.max(1,(line.durationMin??line.service?.durationMin??0)*line.quantity)*60000);
    }
    for(const entry of ticket.pets){
     const petId=entry.petId;
     const serviceLines=ticket.lines.filter(line=>line.petId===petId&&line.lineType==='SERVICE'&&!isRequestLine(line));
     const keys=policy.individualPackageAssignments?[...new Set(serviceLines.map(packageKey))]:[''];
     const actual=responsibleEmployee(ticket.lines,petId);
     for(const key of keys){
      const lines=policy.individualPackageAssignments?serviceLines.filter(l=>packageKey(l)===key):serviceLines;
      const time=petSchedule({...full,lineStarts:starts,lines},petId),from=+time.start,to=from+time.durationMin*60000;
      if(!Number.isFinite(from))continue;
      const userId=actual?.assignedUserId||plannedFor(ticket.lines,plans,petId,key,legacy);
      if(userId&&working(userId,from,to)){reserve(userId,from,to);continue;}
      if(actual||ticket.checkedInAt||!['OPEN','CONFIRMED'].includes(ticket.status)||ticket.bookingAssetId||from<+start||range==='upcoming'&&from<Date.now()||end&&from>=+end||sickId&&userId!==sickId)continue;
      const type=petServiceType({...full,lines},petId),serviceCategories=[...new Set(lines.map(l=>l.service?.category||'').filter(Boolean))];
      candidates.push({row:{ticketId:ticket.id,petId,...(key?{packageKey:key}:{}),pet:entry.pet.name,type,start:time.start.toISOString(),employeeId:'',employee:''},from,to,serviceCategories});
     }
    }
   }
   candidates.sort((a,b)=>a.from-b.from);
   const proposals:Proposal[]=candidates.map(({row,from,to,serviceCategories})=>{
    const qualified=employees.filter(employee=>employee.id!==sickId&&(row.type?coverageQualified(employee,row.type):serviceCategories.length>0&&serviceCategories.every(category=>coverageQualified(employee,category))));
    const available=qualified.find(employee=>working(employee.id,from,to)&&!(slots.get(employee.id)||[]).some(slot=>slot.start<to&&slot.end>from));
    if(!available)return {...row,reason:qualified.length?'No qualified employee is free at this time.':'No matching employee qualification.'};
    reserve(available.id,from,to);
    return {...row,employeeId:available.id,employee:employeeName(available)};
   });
   if(!apply)return {proposals,timezone:zone};
   const approved=proposals.filter(p=>p.employeeId);
   const signature=(p:Proposal)=>JSON.stringify([p.ticketId,p.petId,p.packageKey||'',p.employeeId,p.start]);
   if(!Array.isArray(body.proposals)||JSON.stringify(body.proposals.map(signature))!==JSON.stringify(approved.map(signature)))
    throw Error('Coverage changed. Review the updated suggestions before applying.');
   const byTicket=new Map<string,Proposal[]>();
   for(const row of approved)byTicket.set(row.ticketId,[...(byTicket.get(row.ticketId)||[]),row]);
   for(const [ticketId,changes] of byTicket){
    const ticket=tickets.find(t=>t.id===ticketId)!;
    const previous=(settings.get(plannedSettingKey(ticketId)) as {items?:PlannedPackage[]})?.items||[];
    const next=changes.map(p=>({petId:p.petId,packageKey:p.packageKey,userId:p.employeeId}));
    const replaced=new Set(next.map(plannedKey));
    await writePlannedPackages(tx,tenantId,ticketId,[...previous.filter(p=>!replaced.has(plannedKey(p))),...next],ticket,previous);
    await tx.ticket.update({where:{id:ticketId},data:{updatedAt:new Date()}});
    await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'TICKET',entityId:ticketId,customerId:ticket.customerId,action:'CALENDAR_COVERAGE',summary:'Updated planned Calendar coverage.',details:{previous,assignments:next.map(p=>({...p,packageKey:p.packageKey||null}))}}});
   }
   return {assigned:approved.length,ticketIds:[...byTicket.keys()]};
  },{isolationLevel:apply?Prisma.TransactionIsolationLevel.Serializable:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:15000});
  return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({error:(error as Error).message},{status:409});}
}
export const POST=withRequestPolicy(review,{feature:'CALENDAR'});
export const PUT=withRequestPolicy(review,{feature:'CALENDAR'});
