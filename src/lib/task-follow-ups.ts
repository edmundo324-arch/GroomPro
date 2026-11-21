import {staffTaskPrefix,taskVisible} from './staff-tasks';
import {customRulePrefix,customRuleDraft} from './custom-rule-policy';
import {loadTaskRulePlan} from './custom-rule-task-event';
import {followUpClaimKey} from './ticket-follow-ups';
type Access={userId:string;manager:boolean;hideOwners:boolean};
export async function taskFollowUps(tx:any,tenantId:string,taskId:string,access:Access){
 const task=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:staffTaskPrefix+taskId}}}))?.value;
 if(!task||!taskVisible(task,access.userId,access.manager)||!await tx.user.findFirst({where:{tenantId,id:task.assigneeId,...(access.hideOwners?{role:{not:'PLATFORM_OWNER'}}:{})}}))throw Error('This task is not available to your account.');
 if(task.customerId&&!await tx.customer.findFirst({where:{tenantId,id:task.customerId},select:{id:true}}))throw Error('This customer task is not shared with this shop.');
 const saved=await tx.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:customRulePrefix}},select:{value:true}});
 const rules=saved.map((r:any)=>r.value).filter((r:any)=>r?.state==='ACTIVE'&&r.event==='TASK_OVERDUE').map((r:any)=>({...r,...customRuleDraft(r)}));
 const loaded=await loadTaskRulePlan(tx,tenantId,task,rules),rows:any[]=[];
 if(loaded&&!await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:followUpClaimKey(loaded.eventId)}}})){const {plan,timezone,eventId}=loaded;rows.push({eventId,ruleId:plan.rule.id,revision:plan.rule.revision,taskRevision:task.revision,name:plan.rule.name,dueAt:plan.dueAt.toISOString(),timezone});}
 return {rows,taskId,assigneeId:task.assigneeId};
}
export async function stopTaskFollowUp(client:any,tenantId:string,input:any,access:Access){
 if(typeof input.reason!=='string'||!input.reason.trim()||input.reason.trim().length>1000)throw Error('Explain why this follow-up is no longer needed. Your reason stays in the task history.');
 return client.$transaction(async(tx:any)=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  const current=await taskFollowUps(tx,tenantId,input.taskId,access),row=current.rows.find((r:any)=>r.eventId===input.eventId&&r.ruleId===input.ruleId&&r.revision===input.revision&&r.taskRevision===input.taskRevision);
  if(!row)throw Error('This follow-up has changed or already started. Refresh the list before trying again.');
  const stoppedAt=new Date().toISOString(),value={eventId:row.eventId,ruleId:row.ruleId,revision:row.revision,taskId:input.taskId,stoppedAt,stoppedBy:access.userId,reason:input.reason.trim()};
  await tx.tenantSetting.create({data:{tenantId,settingKey:followUpClaimKey(row.eventId),value}});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:access.userId,entityType:'USER',entityId:current.assigneeId,action:'CUSTOM_RULE_FOLLOW_UP_STOPPED',summary:'Stopped pending task follow-up: '+row.name,details:value}});
  return {stoppedAt};
 });
}
