import {loadTaskRulePlan} from './custom-rule-task-event';
import {staffTaskPrefix,taskOverdue} from './staff-tasks';
import {type ExecutableCustomRule} from './custom-rule-plan';
import {recordRuleStaffAction} from './custom-rule-staff-actions';
export async function runOverdueTaskRules(client:any,tenant:any,rules:ExecutableCustomRule[],after='',now=new Date()){
 const candidates=rules.filter(r=>r.event==='TASK_OVERDUE');if(!candidates.length)return null;
 const began=Date.now();let last=after;
 const tenantId=tenant.id,rows=await client.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:staffTaskPrefix,...(after?{gt:after}:{})}},orderBy:{settingKey:'asc'},take:100});
 for(const row of rows){if(last&&Date.now()-began>40000)return last;last=row.settingKey;let selectedRuleId='';try{const task=row.value;if(!taskOverdue(task,now))continue;
  const loaded=await loadTaskRulePlan(client,tenantId,task,candidates,now);if(!loaded)continue;const {plan,customer,timezone,eventId}=loaded;if(!plan?.ready)continue;selectedRuleId=plan.rule.id;
  const values={businessName:tenant.name,taskTitle:task.title,dueDate:task.dueDate,...(customer?{customerName:[customer.firstName,customer.lastName].filter(Boolean).join(' '),balanceDue:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(customer.balanceCents/100)}:{})};
  for(const action of plan.rule.actions.filter(a=>a.kind!=='MESSAGE'))await recordRuleStaffAction(client,tenantId,plan.rule as any,action,{id:eventId,customerId:customer?.id,timezone,validate:async tx=>{const current=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:row.settingKey}}}))?.value;return !!current&&current.revision===task.revision&&taskOverdue(current,new Date());}},values);
 }catch(e){const settingKey='CUSTOM_RULE_TASK_ERROR:'+row.settingKey,value={taskKey:row.settingKey,customerId:row.value?.customerId||null,ruleId:selectedRuleId,checkedAt:new Date().toISOString(),message:(e as Error).message};await client.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey}},create:{tenantId,settingKey,value},update:{value}});}}return rows.length===100?rows[rows.length-1].settingKey:null;
}
