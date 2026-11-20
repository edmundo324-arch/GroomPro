import {refreshRebookingDiscounts} from './rebooking-discount-store';
import {attendanceFor,attendanceKey} from './customer-attendance';
import {readAppointmentMessageSettings} from './appointment-message-store';
export function attendanceDecisionDetails(error:unknown){return (error as any)?.attendanceDecision?{attendanceDecision:(error as any).attendanceDecision}:{};}
async function recordAttendanceDecision(tx:any,ticket:any,newStart:Date,request:{headers:Headers},userId:string){
 const oldStart=ticket.scheduledStart?.toISOString()||'',nextStart=newStart.toISOString();if(oldStart===nextStart)return;
 const tenantId=ticket.tenantId,settingKey=attendanceKey(ticket.id),where={tenantId_settingKey:{tenantId,settingKey}},row=await tx.tenantSetting.findUnique({where});
 if(!row)return;
 const current=attendanceFor(row.value,ticket.scheduledStart),{policy}=await readAppointmentMessageSettings(tenantId,tx);
 let choice:any;try{choice=JSON.parse(request.headers.get('x-groompro-attendance-choice')||'null')}catch{}
 const matched=choice?.ticketId===ticket.id&&choice.from===oldStart&&choice.to===nextStart&&typeof choice.send==='boolean';
 if(current.confirmedAt&&policy.enabled&&policy.promptOnReschedule&&!matched){
  throw Object.assign(Error('This customer confirmed the previous appointment time. Send a new confirmation request for the changed time?'),{attendanceDecision:{ticketId:ticket.id,from:oldStart,to:nextStart}});
 }
 const send=!!current.confirmedAt&&policy.enabled&&policy.promptOnReschedule&&matched&&choice.send;
 const value={...current,revision:current.revision+1,scheduledStart:nextStart,confirmedAt:null,requestsPausedForStart:!send&&(current.confirmedAt||current.requestsPausedForStart===oldStart)?nextStart:null,newRequestAt:send?new Date().toISOString():null};
 await tx.tenantSetting.upsert({where,create:{tenantId,settingKey,value},update:{value}});
 await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:userId,entityType:'TICKET',entityId:ticket.id,customerId:ticket.customerId,action:'ATTENDANCE_AFTER_MOVE',summary:send?'Employee requested a new attendance confirmation after moving the appointment.':current.confirmedAt?'Appointment moved without requesting another attendance confirmation.':'Updated reminder dates after moving the appointment.',details:{previousStart:oldStart,newStart:nextStart,previousConfirmedAt:current.confirmedAt,requestNewConfirmation:send}}});
}

export async function recordAttendanceMove(tx:any,ticket:any,newStart:Date,request:{headers:Headers},userId:string){await recordAttendanceDecision(tx,ticket,newStart,request,userId);await refreshRebookingDiscounts(tx,ticket.tenantId,ticket.id,userId,newStart);}
