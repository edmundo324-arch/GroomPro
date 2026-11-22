import recovery from './calendar-assignment-recovery.json';
import {createHash} from 'node:crypto';
import {assignmentApproval,approvalMatches} from './calendar-assignment-approval';
import type {PlannedPackage} from './planned-package-rules';

// Read-only recovery of the sample appointments explicitly approved before
// scheduling exceptions were persisted. No schedule or ticket data is rewritten.
const recoveredApprovals=new Set(recovery);
export function calendarApprovalSignature(tenantId:string,ticket:any,plan:PlannedPackage){
 const approval=assignmentApproval(ticket,plan.petId,plan.userId||'');
 return createHash('sha256').update(JSON.stringify([tenantId,ticket.locationId,ticket.id,plan.petId,plan.userId,approval.start,approval.durationMin])).digest('hex');
}
export function calendarAssignmentPlans(tenantId:string,ticket:any,plans:PlannedPackage[],approved=recoveredApprovals):PlannedPackage[]{
 return plans.map(plan=>{
  const recovered=!!plan.userId&&!!ticket.scheduledStart&&approved.has(calendarApprovalSignature(tenantId,ticket,plan));
  return {...plan,calendarAvailabilityApproved:approvalMatches(ticket,plan)||recovered};
 });
}
