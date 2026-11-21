import {type CustomRuleEvent} from './custom-rule-policy';
export function ticketRuleEvent(audit:any):CustomRuleEvent|null{
 if(audit.entityType!=='TICKET')return null;
 if(['CREATE','REBOOK'].includes(audit.action))return 'APPOINTMENT_CREATED';
 if(audit.action==='ONLINE_BOOKING_REVIEW')return audit.details?.decision==='ACCEPTED'?'APPOINTMENT_CREATED':audit.details?.decision==='REJECTED'?'APPOINTMENT_CANCELLED':null;
 if(audit.action==='CUSTOMER_ATTENDANCE_CONFIRMED')return 'APPOINTMENT_CONFIRMED';
 if(audit.action==='MOVE')return 'APPOINTMENT_CHANGED';
 if(audit.action==='CLOSE')return 'CLOSED';
 if(['NO_SHOW_FEE_CHARGED','NO_SHOW_FEE_TO_ACCOUNT'].includes(audit.action)&&audit.details?.noShowStatus==='NO_SHOW')return 'NO_SHOW';
 if(audit.action==='CUSTOMER_CANCELLATION'&&audit.details?.state==='ON_TIME'||audit.action==='CANCELLATION_REVIEW'&&!audit.details?.keptAppointment&&['WAIVED','FEE_APPLIED'].includes(audit.details?.state))return 'APPOINTMENT_CANCELLED';
 if(audit.action==='STATUS_CHANGE')return ({CHECKED_IN:'CHECKED_IN',READY:'READY',NO_SHOW:'NO_SHOW',CANCELLED:'APPOINTMENT_CANCELLED'} as Record<string,CustomRuleEvent>)[audit.details?.newStatus]||null;
 return null;
}
export function ticketRuleEventCurrent(event:CustomRuleEvent,audit:any,ticket:any,attendance:any,voided:boolean,latestEventId:string){
 if(latestEventId!==audit.id||!ticket||voided||ticket.tenantId!==audit.tenantId||ticket.id!==audit.entityId||audit.customerId&&audit.customerId!==ticket.customerId)return false;
 const active=['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY'].includes(ticket.status),sameStart=(value:any)=>!!value&&!!ticket.scheduledStart&&+new Date(value)===+new Date(ticket.scheduledStart);
 if(event==='APPOINTMENT_CREATED')return active&&!['REQUESTED','PENDING','REJECTED'].includes(ticket.bookingDecision)&&sameStart(audit.details?.scheduledStart);
 if(event==='APPOINTMENT_CONFIRMED')return active&&sameStart(audit.details?.scheduledStart)&&!!attendance?.confirmedAt&&sameStart(attendance.scheduledStart);
 if(event==='APPOINTMENT_CHANGED')return active&&sameStart(audit.details?.newStart);
 if(event==='APPOINTMENT_CANCELLED')return ticket.status==='CANCELLED';
 if(event==='CHECKED_IN')return ticket.status==='CHECKED_IN';
 if(event==='READY')return ticket.status==='READY'&&!ticket.pickupCompletedAt;
 if(event==='CLOSED')return ticket.status==='CLOSED';
 if(event==='NO_SHOW')return ticket.status==='NO_SHOW'||ticket.status==='CANCELLED'&&!!ticket.noShowFeeProcessedAt&&audit.details?.noShowStatus==='NO_SHOW'&&['NO_SHOW_FEE_CHARGED','NO_SHOW_FEE_TO_ACCOUNT'].includes(audit.action);
 return false;
}
