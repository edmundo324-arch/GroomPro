import {selectCustomerRule} from './custom-rule-pet-targets';
import {taskOverdue} from './staff-tasks';
import {localToInstant} from './operating-hours';
import {shiftDate} from './schedule-dates';
import {type ExecutableCustomRule} from './custom-rule-plan';
export async function loadTaskRulePlan(client:any,tenantId:string,task:any,rules:ExecutableCustomRule[],now=new Date()){
 if(!taskOverdue(task,now))return null;
  const customer=task.customerId?await client.customer.findFirst({where:{tenantId,id:task.customerId,active:true}}):null;if(task.customerId&&!customer)return null;
  const [tags,vip,future,home]=customer?await Promise.all([client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOMER_TAGS:'+customer.id}}}),client.$queryRaw`SELECT id FROM Membership WHERE tenantId=${tenantId} AND customerId=${customer.id} AND status IN ('ACTIVE','CANCELLATION_REQUESTED','PAUSE_REQUESTED') LIMIT 1`,client.ticket.findFirst({where:{tenantId,customerId:customer.id,scheduledStart:{gt:now},status:{in:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY']},bookingDecision:{notIn:['REQUESTED','PENDING']}},select:{id:true}}),client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOMER_HOME_LOCATION:'+customer.id}}})]):[null,[],null,null];
  const eligible=customer?rules:rules.filter(r=>r.conditions.vip==='ANY'&&r.conditions.upcoming==='ANY'&&r.conditions.attendance==='ANY'&&!r.conditions.tagIds.length),timezone=task.timezone||'America/Chicago',eventId='task-overdue:'+task.id+':'+task.dueDate;
  const plan=await selectCustomerRule(client,tenantId,customer?.id,eligible,{id:eventId,event:'TASK_OVERDUE',occurredAt:localToInstant(shiftDate(task.dueDate,1)+'T00:00',timezone).toISOString(),locationId:task.locationId||home?.value?.locationId||'',current:true,facts:{vipActive:!!vip.length,hasUpcomingAppointment:!!future,attendanceConfirmed:false,tagIds:tags?.value?.tagIds||[]}},now);
 return plan?{plan,customer,timezone,eventId}:null;
}
