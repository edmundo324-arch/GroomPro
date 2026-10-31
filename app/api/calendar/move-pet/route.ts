import {moveGroomingNotes} from '@/src/lib/grooming-notes-store';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {requestLocation} from '@/src/lib/request-location';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {readLineStarts,writeLineStarts} from '@/src/lib/line-time-store';
import {readPlannedPackages,writePlannedPackages} from '@/src/lib/planned-package-store';
import {responsibleEmployee,petSchedule,movePetTimes,scheduleBounds} from '@/src/lib/pet-scheduling';
import {locationHours,appointmentHoursError} from '@/src/lib/location-hours';
import {zonedParts} from '@/src/lib/operating-hours';
import {employeeAvailable} from '@/src/lib/groomer-assignment';
import {approvedScheduling} from '@/src/lib/scheduling-authorization';
import {schedulingException,warningDetails} from '@/src/lib/scheduling-warning';
import {checkCustomerBookingRules} from '@/src/lib/booking-rules';
async function move(r:NextRequest){const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'',sid=r.cookies.get('groompro_session')?.value;const session=sid?await getActiveEmployeeSession(tenantId,sid):null;if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 try{const b=await r.json(),locationId=await requestLocation(r,tenantId),start=new Date(b.scheduledStart);if(!b.ticketId||!b.petId||!Number.isFinite(+start))throw Error('Choose a dog and a valid appointment time.');if(!locationId)throw Error('Select a location.');const hours=await locationHours(tenantId,locationId);
 const result=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${String(b.ticketId)} AND tenantId=${tenantId} FOR UPDATE`;
  const ticket=await tx.ticket.findFirst({where:{id:b.ticketId,tenantId,locationId},include:{pets:true,lines:{include:{service:true},orderBy:{sortOrder:'asc'}},assignments:true}});if(!ticket||['CLOSED','CANCELLED','NO_SHOW'].includes(ticket.status))throw Error('Choose an open appointment.');if(!ticket.lines.some(l=>l.petId===b.petId))throw Error('This dog is not on the appointment.');if(responsibleEmployee(ticket.lines,b.petId))throw Error('This dog has an actual employee assignment. Change it in POS or Whiteboard.');
  const lineStarts=await readLineStarts(tx,tenantId,ticket.id),live={...ticket,lineStarts},previous=petSchedule(live,b.petId);
  if(b.expectedStart&&+new Date(b.expectedStart)!==+previous.start)throw Error('This dog’s time changed elsewhere. Refresh before moving.');
  const message=await appointmentHoursError(tenantId,locationId,start,previous.durationMin);if(message)throw Error(message);
  const plans=await readPlannedPackages(tenantId,ticket.id,tx),oldPlan=plans.find(p=>p.petId===b.petId&&!p.packageKey),oldEmployee=oldPlan?oldPlan.userId:ticket.assignments.find(a=>a.role==='PLANNED_GROOMER')?.userId||null;const employeeId=b.employeeId===undefined?oldEmployee:b.employeeId||null;if(employeeId&&!await tx.user.findFirst({where:{id:employeeId,tenantId,active:true,OR:[{locationId},{locationId:null}]}}))throw Error('Choose an active employee at this location.');
  if(employeeId&&!await employeeAvailable(tenantId,employeeId,locationId,start,previous.durationMin)&&!await approvedScheduling(r,'The selected employee is unavailable at this time.'))throw schedulingException('The selected employee is unavailable at this time.');
  const sameDay=zonedParts(previous.start,hours.timezone).date===zonedParts(start,hours.timezone).date;
  if(!sameDay){const rules=await checkCustomerBookingRules(tenantId,ticket.customerId,start,previous.durationMin,ticket.pets.map(p=>p.petId),ticket.id);const text=rules.conflicts.length?'Nearby appointment warning: '+rules.conflicts.map(c=>c.message).join(' '):'';if(text&&!await approvedScheduling(r,text))throw schedulingException(text);}
  const nextStarts=movePetTimes(live,b.petId,start),bounds=scheduleBounds(live,nextStarts);
  if(ticket.timingMode==='CONCURRENT'&&+previous.start!==+start)for(const pet of ticket.pets.filter(p=>p.petId!==b.petId)){const actual=responsibleEmployee(ticket.lines,pet.petId),userId=actual?.assignedUserId||plans.find(p=>p.petId===pet.petId&&!p.packageKey)?.userId;if(userId){const period=petSchedule({...live,lineStarts:nextStarts},pet.petId);if(!await employeeAvailable(tenantId,userId,locationId,period.start,period.durationMin)&&!await approvedScheduling(r,'This employee is unavailable for this appointment.'))throw schedulingException('This employee is unavailable for this appointment.');}}
  const changed=plans.filter(p=>p.petId!==b.petId);changed.push({petId:b.petId,userId:employeeId});for(const p of plans.filter(p=>p.petId===b.petId&&p.packageKey))changed.push({...p,userId:employeeId});
  if(b.employeeId!==undefined)await writePlannedPackages(tx,tenantId,ticket.id,changed,ticket,plans);await writeLineStarts(tx,tenantId,ticket.id,nextStarts,ticket);
  if(!sameDay)await moveGroomingNotes(tx,tenantId,ticket.id,ticket.timingMode==='CONCURRENT'?new Date(bounds.scheduledStart):start,ticket.timingMode==='CONCURRENT'?undefined:b.petId);
  const updated=await tx.ticket.update({where:{id:ticket.id},data:bounds});
  await tx.ticketScheduleHistory.create({data:{tenantId,ticketId:ticket.id,actorUserId:session.user.id,changeType:'MOVED',previousStart:ticket.scheduledStart,newStart:new Date(bounds.scheduledStart)}});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'TICKET',entityId:ticket.id,customerId:ticket.customerId,action:'MOVE_PET',summary:'Moved one dog’s planned Calendar placement.',details:{petId:b.petId,employeeId,previousStart:previous.start.toISOString(),newStart:start.toISOString(),timingMode:ticket.timingMode}}});return {ticket:updated};
 });return NextResponse.json(result);
 }catch(e){return NextResponse.json({error:(e as Error).message,...warningDetails(e)},{status:409})}
}
export const PATCH=withRequestPolicy(move,{feature:'CALENDAR'});
