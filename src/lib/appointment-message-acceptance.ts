import {readAppointmentMessageSettings,appointmentMessageKey} from './appointment-message-store';
import {attendanceKey} from './customer-attendance';
// Called inside the booking transaction: rolled-back or unaccepted bookings never queue a request.
export async function queueInitialAttendanceRequest(tx:any,ticket:any){
 if(!ticket.scheduledStart||+new Date(ticket.scheduledStart)<=Date.now()||!['OPEN','CONFIRMED'].includes(ticket.status)||['REQUESTED','PENDING'].includes(ticket.bookingDecision))return;
 const tenantId=ticket.tenantId,now=new Date().toISOString();let settings=await readAppointmentMessageSettings(tenantId,tx);
 if(!settings.revision){const value={...settings,revision:1,activeSince:now};const row=await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey:appointmentMessageKey}},create:{tenantId,settingKey:appointmentMessageKey,value},update:{}});settings=row.value;}
 if(!settings.policy.enabled)return;
 const settingKey=attendanceKey(ticket.id),value={revision:1,scheduledStart:new Date(ticket.scheduledStart).toISOString(),confirmedAt:null,reminders:[],newRequestAt:now};
 await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey}},create:{tenantId,settingKey,value},update:{}});
}
