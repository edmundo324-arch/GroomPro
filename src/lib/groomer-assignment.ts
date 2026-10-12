import {db} from './db';
import {zonedParts} from './operating-hours';

// Planned assignments never write service lines. Actual assignments live on lines.
export async function employeeAvailable(tenantId:string,userId:string,locationId:string,start:Date,durationMin:number){
 const user=await db.user.findFirst({where:{id:userId,tenantId,active:true,OR:[{locationId},{locationId:null}]}});
 if(!user)return false;
 const location=await db.location.findFirst({where:{id:locationId,tenantId}});
 const zone=location?.timezone||'America/Chicago',a=zonedParts(start,zone),b=zonedParts(new Date(+start+Math.max(1,durationMin)*60000),zone);
 if(a.date!==b.date)return false;
 const override=await db.scheduleOverride.findUnique({where:{tenantId_resourceKind_resourceId_date:{tenantId,resourceKind:'employee',resourceId:userId,date:a.date}}});
 if(override)return !override.dayOff&&!!override.startTime&&!!override.endTime&&a.time>=override.startTime&&b.time<=override.endTime;
 const day=new Date(a.date+'T12:00:00Z').getUTCDay();
 const shifts=await db.$queryRaw<{startTime:string;endTime:string}[]>`SELECT startTime,endTime FROM EmployeeSchedule WHERE tenantId=${tenantId} AND userId=${userId} AND dayOfWeek=${day} AND active=1`;
 return shifts.some(s=>a.time>=s.startTime&&b.time<=s.endTime);
}

export async function syncActualGroomers(tx:any,ticketId:string){
 const lines=await tx.ticketLine.findMany({where:{ticketId,role:'GROOM',assignmentUnavailable:false}});
 await tx.ticketAssignment.deleteMany({where:{ticketId,role:'GROOMER'}});
 for(const userId of new Set<string>(lines.map((l:any)=>l.assignedUserId).filter(Boolean)))await tx.ticketAssignment.create({data:{ticketId,userId,role:'GROOMER'}});
}

export async function setPlannedGroomer(tenantId:string,ticketId:string,userId:string|null){
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticketId} AND tenantId=${tenantId} FOR UPDATE`;
  const ticket=await tx.ticket.findFirst({where:{id:ticketId,tenantId},include:{assignments:{where:{role:'GROOMER'}}}});
  if(!ticket)throw Error('Appointment not found.');
  if(ticket.checkedInAt||['CHECKED_IN','IN_PROGRESS','READY','CLOSED','CANCELLED','NO_SHOW'].includes(ticket.status))throw Error('Use the service-line assignments for a dog already in the queue.');
  if(userId&&(!ticket.scheduledStart||!await employeeAvailable(tenantId,userId,ticket.locationId,ticket.scheduledStart,ticket.durationMin)))throw Error('Choose an available groomer or Assign later.');
  await tx.ticketAssignment.deleteMany({where:{ticketId,role:{in:['GROOMER','PLANNED_GROOMER']}}});
  if(userId)await tx.ticketAssignment.createMany({data:[{ticketId,userId,role:'GROOMER'},{ticketId,userId,role:'PLANNED_GROOMER'}]});
  return ticket;
 });
}

// Preserve attribution; flag unavailable actual work instead of erasing history.
export async function reconcileEmployeeAssignments(tenantId:string,scope:{locationId?:string;start?:Date;end?:Date;ticketId?:string}={}){
 const tickets=await db.ticket.findMany({where:{tenantId,...(scope.locationId?{locationId:scope.locationId}:{}),...(scope.ticketId?{id:scope.ticketId}:{}),scheduledStart:{gte:scope.start&&+scope.start>Date.now()-86400000?scope.start:new Date(Date.now()-86400000),...(scope.end?{lt:scope.end}:{})},status:{in:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS']}},include:{assignments:true,lines:true}});
 for(const ticket of tickets){
  const candidates=new Set([...ticket.assignments.filter(a=>a.role==='GROOMER').map(a=>a.userId),...ticket.lines.map(l=>l.assignedUserId).filter((id):id is string=>!!id)]);
  const unavailable:string[]=[];
  for(const userId of candidates)if(!await employeeAvailable(tenantId,userId,ticket.locationId,ticket.scheduledStart!,ticket.durationMin))unavailable.push(userId);
  if(!unavailable.length)continue;
  await db.$transaction(async tx=>{
   const removed=await tx.ticketAssignment.deleteMany({where:{ticketId:ticket.id,role:'GROOMER',userId:{in:unavailable}}});
   const flagged=await tx.ticketLine.updateMany({where:{ticketId:ticket.id,assignedUserId:{in:unavailable},assignmentUnavailable:false},data:{assignmentUnavailable:true}});
   if(removed.count||flagged.count)await tx.auditEntry.create({data:{tenantId,actorType:'SYSTEM',entityType:'TICKET',entityId:ticket.id,customerId:ticket.customerId,action:'EMPLOYEE_UNAVAILABLE',summary:'Moved unavailable employee assignments to Unassigned / Other Appointments.',details:{employeeIds:unavailable,removedCalendarAssignments:removed.count,flaggedLines:flagged.count}}});
  });
 }
}
