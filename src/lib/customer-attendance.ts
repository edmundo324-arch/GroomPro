import {db} from './db';
import {messageTimes,type MessageTime} from './appointment-message-policy';
export const attendanceKey=(ticketId:string)=>'CUSTOMER_ATTENDANCE:'+ticketId;
export type Attendance={revision:number;scheduledStart:string;confirmedAt:string|null;reminders:MessageTime[];requestsPausedForStart?:string|null;newRequestAt?:string|null;requestScheduleStartsAt?:string|null;newRequestChannels?:Array<'SMS'|'EMAIL'>|null};
export function attendanceFor(value:any,start:Date|null):Attendance{
 const scheduledStart=start?.toISOString()||'',sameStart=!!value?.scheduledStart&&!!start&&+new Date(value.scheduledStart)===+start;
 return {newRequestChannels:sameStart&&Array.isArray(value?.newRequestChannels)?value.newRequestChannels.filter((c:string)=>['SMS','EMAIL'].includes(c)):null,revision:value?.revision||0,requestScheduleStartsAt:value?.requestScheduleStartsAt||null,scheduledStart,confirmedAt:sameStart?value.confirmedAt||null:null,reminders:messageTimes(value?.reminders||[]),requestsPausedForStart:value?.requestsPausedForStart||null,newRequestAt:sameStart?value?.newRequestAt||null:null};
}
export async function updateCustomerAttendance(tenantId:string,customerId:string,ticketId:string,input:{revision:number;scheduledStart:string;confirm?:boolean;reminders?:unknown}){
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticketId} AND tenantId=${tenantId} AND customerId=${customerId} FOR UPDATE`;
  const ticket=await tx.ticket.findFirst({where:{tenantId,id:ticketId,customerId,status:{in:['OPEN','CONFIRMED']},bookingDecision:{notIn:['REQUESTED','PENDING']}}});
  if(!ticket?.scheduledStart||+ticket.scheduledStart<=Date.now())throw Error('This appointment is no longer available for confirmation. Refresh your appointments or contact the shop.');
  if(ticket.scheduledStart.toISOString()!==input.scheduledStart)throw Error('The appointment time changed. Refresh your appointments before confirming or choosing reminders.');
  const settingKey=attendanceKey(ticketId),where={tenantId_settingKey:{tenantId,settingKey}},row=await tx.tenantSetting.findUnique({where}),current=attendanceFor(row?.value,ticket.scheduledStart);
  if(current.revision!==input.revision)throw Error('Your confirmation or reminder choices changed on another device. Refresh your appointments to review them.');
  if(input.confirm!==true&&input.reminders===undefined)throw Error('Choose confirmation or reminder times before saving.');
  const value:Attendance={...current,revision:current.revision+1,confirmedAt:input.confirm===true?current.confirmedAt||new Date().toISOString():current.confirmedAt,reminders:input.reminders===undefined?current.reminders:messageTimes(input.reminders)};
  await tx.tenantSetting.upsert({where,create:{tenantId,settingKey,value:JSON.parse(JSON.stringify(value))},update:{value:JSON.parse(JSON.stringify(value))}});
  if(input.confirm===true&&ticket.status==='OPEN')await tx.ticket.update({where:{id:ticket.id,status:'OPEN'},data:{status:'CONFIRMED'}});
  await tx.auditEntry.create({data:{tenantId,actorType:'SYSTEM',entityType:'TICKET',entityId:ticket.id,customerId,action:input.confirm?'CUSTOMER_ATTENDANCE_CONFIRMED':'CUSTOMER_REMINDER_CHOICES',summary:input.confirm?'Customer confirmed attendance for the saved appointment time.':'Customer updated appointment reminder choices.',details:{scheduledStart:value.scheduledStart,confirmedAt:value.confirmedAt,reminders:value.reminders}}});
  return value;
 });
}

// A staff-recorded customer confirmation stops the same requests as a portal reply.
// Shop acceptance and undo-check-in use separate paths and do not call this helper.
export async function recordStaffAttendance(tx:any,ticket:any,actorUserId:string){
 if(!ticket.scheduledStart||['REQUESTED','PENDING','REJECTED'].includes(ticket.bookingDecision))return;
 const tenantId=ticket.tenantId,settingKey=attendanceKey(ticket.id),where={tenantId_settingKey:{tenantId,settingKey}},row=await tx.tenantSetting.findUnique({where}),current=attendanceFor(row?.value,new Date(ticket.scheduledStart));
 if(current.confirmedAt)return;
 const value={...current,revision:current.revision+1,confirmedAt:new Date().toISOString()};
 await tx.tenantSetting.upsert({where,create:{tenantId,settingKey,value},update:{value}});
 await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId,entityType:'TICKET',entityId:ticket.id,customerId:ticket.customerId,action:'CUSTOMER_ATTENDANCE_CONFIRMED',summary:'Staff recorded that the customer confirmed the appointment.',details:{scheduledStart:value.scheduledStart,confirmedAt:value.confirmedAt,reminders:value.reminders,recordedByStaff:true}}});
}
