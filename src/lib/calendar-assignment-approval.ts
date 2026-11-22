import {petSchedule} from './pet-scheduling';

export type AssignmentApproval={start:string;durationMin:number;userId:string;locationId:string};
export function assignmentApproval(ticket:any,petId:string,userId:string):AssignmentApproval{
 const period=petSchedule(ticket,petId);
 return {start:period.start.toISOString(),durationMin:period.durationMin,userId,locationId:ticket.locationId};
}
// An exception belongs to this booking, not to the employee's general hours.
export function approvalMatches(ticket:any,plan:any){
 if(!plan.userId||!plan.availabilityApproval)return false;
 const period=petSchedule(ticket,plan.petId),approval=plan.availabilityApproval;
 return approval.userId===plan.userId&&approval.locationId===ticket.locationId&&Number.isFinite(+period.start)&&+period.start===+new Date(approval.start)&&period.durationMin===approval.durationMin;
}
