import {enforceTicketArrivalLimit,readTicketArrivalReservations} from './employee-arrival-validation';
import {employeeLocationContext} from './employee-shift-location';
import {schedulingException} from './scheduling-warning';
import {resourceBlocked} from './calendar-blocks';
import {db} from './db';
import {zonedParts} from './operating-hours';

// Planned assignments never write service lines. Actual assignments live on lines.
export async function employeeAvailable(tenantId:string,userId:string,locationId:string,start:Date,durationMin:number,ignoreBlocks=false){
 const user=await db.user.findFirst({where:{id:userId,tenantId,active:true}});
 if(!user)return false;const shiftLocations=await employeeLocationContext(db,tenantId);
 if(!ignoreBlocks&&await resourceBlocked(tenantId,locationId,"employee",userId,start,durationMin))return false;
 const location=await db.location.findFirst({where:{id:locationId,tenantId}});
 const zone=location?.timezone||'America/Chicago',a=zonedParts(start,zone),b=zonedParts(new Date(+start+Math.max(1,durationMin)*60000),zone);
 if(a.date!==b.date)return false;
 const override=await db.scheduleOverride.findUnique({where:{tenantId_resourceKind_resourceId_date:{tenantId,resourceKind:'employee',resourceId:userId,date:a.date}}});
 if(override)return (!shiftLocations.date(userId,a.date,user.locationId)||shiftLocations.date(userId,a.date,user.locationId)===locationId)&&!override.dayOff&&!!override.startTime&&!!override.endTime&&a.time>=override.startTime&&b.time<=override.endTime;
 const day=new Date(a.date+'T12:00:00Z').getUTCDay();
 const shifts=await db.$queryRaw<{id:string;startTime:string;endTime:string}[]>`SELECT id,startTime,endTime FROM EmployeeSchedule WHERE tenantId=${tenantId} AND userId=${userId} AND dayOfWeek=${day} AND active=1`;
 return shifts.some(s=>(!shiftLocations.shift(s.id,user.locationId)||shiftLocations.shift(s.id,user.locationId)===locationId)&&a.time>=s.startTime&&b.time<=s.endTime);
}

export async function syncActualGroomers(tx:any,ticketId:string){
 const lines=await tx.ticketLine.findMany({where:{ticketId,role:'GROOM',assignmentUnavailable:false}});
 await tx.ticketAssignment.deleteMany({where:{ticketId,role:'GROOMER'}});
 for(const userId of new Set<string>(lines.map((l:any)=>l.assignedUserId).filter(Boolean)))await tx.ticketAssignment.create({data:{ticketId,userId,role:'GROOMER'}});
}

export async function setPlannedGroomer(tenantId:string,ticketId:string,userId:string|null,allowUnavailable=false,approveArrival?:(message:string)=>Promise<boolean>){
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticketId} AND tenantId=${tenantId} FOR UPDATE`;
  const ticket=await tx.ticket.findFirst({where:{id:ticketId,tenantId},include:{assignments:{where:{role:'GROOMER'}}}});
  if(!ticket)throw Error('Appointment not found.');
  if(ticket.checkedInAt||['CHECKED_IN','IN_PROGRESS','READY','CLOSED','CANCELLED','NO_SHOW'].includes(ticket.status))throw Error('Use the service-line assignments for a dog already in the queue.');
  if(userId&&!await tx.user.findFirst({where:{id:userId,tenantId,active:true}}))throw Error('Selected groomer not found.');
  if(!allowUnavailable&&userId&&(!ticket.scheduledStart||!await employeeAvailable(tenantId,userId,ticket.locationId,ticket.scheduledStart,ticket.durationMin)))throw schedulingException('Choose an available groomer or Assign later.');
  const priorArrivals=await readTicketArrivalReservations(tx,tenantId,ticketId);
  await tx.ticketAssignment.deleteMany({where:{ticketId,role:{in:['GROOMER','PLANNED_GROOMER']}}});
  if(userId)await tx.ticketAssignment.createMany({data:[{ticketId,userId,role:'GROOMER'},{ticketId,userId,role:'PLANNED_GROOMER'}]});
  await enforceTicketArrivalLimit(tx,tenantId,ticketId,approveArrival,priorArrivals);
  return ticket;
 });
}

// Preserve attribution; flag unavailable actual work instead of erasing history.
export async function reconcileEmployeeAssignments(tenantId:string,scope:{locationId?:string;start?:Date;end?:Date;ticketId?:string}={}){
 const tickets=await db.ticket.findMany({where:{tenantId,...(scope.locationId?{locationId:scope.locationId}:{}),...(scope.ticketId?{id:scope.ticketId}:{}),scheduledStart:{gte:scope.start&&+scope.start>Date.now()-86400000?scope.start:new Date(Date.now()-86400000),...(scope.end?{lt:scope.end}:{})},status:{in:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS']}},include:{assignments:true,lines:true}});
 const candidatesFor=(ticket:typeof tickets[number])=>new Set([
  ...ticket.assignments.filter(a=>a.role==='GROOMER').map(a=>a.userId),
  ...ticket.lines.filter(line=>!line.assignmentUnavailable).map(line=>line.assignedUserId).filter((id):id is string=>!!id)
 ]);
 const ids=[...new Set(tickets.flatMap(ticket=>[...candidatesFor(ticket)]))];
 if(!ids.length)return;
 const [shiftLocations,users,shifts]=await Promise.all([
  employeeLocationContext(db,tenantId),
  db.user.findMany({where:{tenantId,active:true,id:{in:ids}},select:{id:true,locationId:true}}),
  db.$queryRaw<{id:string;userId:string;dayOfWeek:number;startTime:string;endTime:string}[]>`SELECT id,userId,dayOfWeek,startTime,endTime FROM EmployeeSchedule WHERE tenantId=${tenantId} AND active=1`
 ]);
 const zones=new Map(shiftLocations.locations.map((location:{id:string;timezone:string})=>[location.id,location.timezone] as const));
 const intervals=tickets.map(ticket=>{
  const zone=String(zones.get(ticket.locationId)||'America/Chicago'),start=ticket.scheduledStart!;
  return {ticket,from:zonedParts(start,zone),to:zonedParts(new Date(+start+Math.max(1,ticket.durationMin)*60000),zone)};
 });
 const dates=[...new Set(intervals.map(i=>i.from.date))];
 const overrides=await db.scheduleOverride.findMany({where:{tenantId,resourceKind:'employee',resourceId:{in:ids},date:{in:dates}}});
 const byDate=new Map(overrides.map(row=>[row.resourceId+':'+row.date,row]));
 const staff=new Map(users.map(user=>[user.id,user]));
 for(const {ticket,from,to} of intervals){
  const day=new Date(from.date+'T12:00:00Z').getUTCDay();
  const unavailable=[...candidatesFor(ticket)].filter(id=>{
   const user=staff.get(id);
   if(!user||from.date!==to.date)return true;
   const override=byDate.get(id+':'+from.date);
   if(override){
    const shop=shiftLocations.date(id,from.date,user.locationId);
    return !!(shop&&shop!==ticket.locationId)||override.dayOff||!override.startTime||!override.endTime||from.time<override.startTime||to.time>override.endTime;
   }
   return !shifts.some(shift=>{
    if(shift.userId!==id||shift.dayOfWeek!==day||from.time<shift.startTime||to.time>shift.endTime)return false;
    const shop=shiftLocations.shift(shift.id,user.locationId);
    return !shop||shop===ticket.locationId;
   });
  });
  if(!unavailable.length)continue;
  await db.$transaction(async tx=>{
   const legacy=ticket.assignments.find(a=>a.role==='GROOMER');
   if(legacy&&unavailable.includes(legacy.userId)&&!ticket.assignments.some(a=>a.role==='PLANNED_GROOMER')&&!ticket.lines.some(line=>line.assignedUserId===legacy.userId)){
    await tx.ticketAssignment.createMany({data:[{ticketId:ticket.id,userId:legacy.userId,role:'PLANNED_GROOMER'}],skipDuplicates:true});
   }
   const removed=await tx.ticketAssignment.deleteMany({where:{ticketId:ticket.id,role:'GROOMER',userId:{in:unavailable}}});
   const flagged=await tx.ticketLine.updateMany({where:{ticketId:ticket.id,assignedUserId:{in:unavailable},assignmentUnavailable:false},data:{assignmentUnavailable:true}});
   if(removed.count||flagged.count)await tx.auditEntry.create({data:{tenantId,actorType:'SYSTEM',entityType:'TICKET',entityId:ticket.id,customerId:ticket.customerId,action:'EMPLOYEE_UNAVAILABLE',summary:'Moved unavailable employee assignments to Unassigned / Other Appointments.',details:{employeeIds:unavailable,removedCalendarAssignments:removed.count,flaggedLines:flagged.count}}});
  });
 }
}
