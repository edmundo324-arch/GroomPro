import {currentTargetNames} from './custom-rule-pet-targets';
import {createHash} from 'node:crypto';
import {renderCustomRuleText,type CustomRuleDraft,type CustomRuleAction,type customRuleVariables} from './custom-rule-policy';
import {taskFields,staffTaskPrefix} from './staff-tasks';
export const ruleNoticePrefix='CUSTOM_RULE_NOTICE:';
export function ruleActionId(tenantId:string,ruleId:string,eventId:string,actionId:string,recipient:string){const hex=createHash('sha256').update(JSON.stringify([tenantId,ruleId,eventId,actionId,recipient])).digest('hex');return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20,32);}
export async function recordRuleStaffAction(client:any,tenantId:string,rule:CustomRuleDraft&{updatedBy:string},action:CustomRuleAction,event:{id:string;customerId?:string;timezone:string;validate?:(tx:any)=>Promise<boolean>},values:Partial<Record<typeof customRuleVariables[number],string>>){
 if(action.kind==='MESSAGE')throw Error('Customer messages use the delivery service, not staff notices.');
 const at=new Date().toISOString();
 return client.$transaction(async(tx:any)=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  if(event.validate&&!await event.validate(tx))return [];
  const names=await currentTargetNames(tx,tenantId,event.customerId,rule);if(names===null)return [];
  const currentValues={...values,...(names!==undefined?{petName:names}:{})},title=renderCustomRuleText(action.title,currentValues),notes=renderCustomRuleText(action.body,currentValues);
  const saved=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOM_RULE:'+rule.id}}}))?.value;if(saved?.state!=='ACTIVE'||saved.revision!==rule.revision)throw Error('This rule changed before its action ran. Review its current version.');
  if(event.customerId&&!await tx.customer.findFirst({where:{tenantId,id:event.customerId,active:true},select:{id:true}}))throw Error('This customer is no longer available for the rule.');
  const employees=await tx.user.findMany({where:{tenantId,id:{in:action.assigneeIds},active:true},select:{id:true}});
  if(employees.length!==action.assigneeIds.length)throw Error('An assigned employee is unavailable. Review this rule’s staff recipients.');
  if(!await claimRuleEvent(tx,tenantId,rule,event.id,at))return [];
  const ids:string[]=[];for(const employee of employees){
   const id=ruleActionId(tenantId,rule.id,event.id,action.id,employee.id),settingKey=(action.kind==='TASK'?staffTaskPrefix:ruleNoticePrefix)+id,where={tenantId_settingKey:{tenantId,settingKey}};ids.push(id);
   if(await tx.tenantSetting.findUnique({where}))continue;
   const fields=taskFields({title,notes,assigneeId:employee.id,dueDate:''});
   const value=action.kind==='TASK'?{...fields,id,revision:1,timezone:event.timezone,createdBy:rule.updatedBy,createdAt:at,updatedAt:at,completedAt:null,completedBy:null,...(event.customerId?{customerId:event.customerId}:{}),sourceRuleId:rule.id}:{id,title,body:notes,assigneeId:employee.id,...(event.customerId?{customerId:event.customerId}:{}),sourceRuleId:rule.id,createdAt:at,readAt:null};
   await tx.tenantSetting.create({data:{tenantId,settingKey,value}});
   await tx.auditEntry.create({data:{tenantId,actorType:'SYSTEM',entityType:event.customerId?'CUSTOMER':'TENANT',entityId:event.customerId||tenantId,...(event.customerId?{customerId:event.customerId}:{}),action:'CUSTOM_RULE_'+action.kind,summary:action.kind==='TASK'?'Created an automatic staff task.':'Created an internal staff notification.',details:{ruleId:rule.id,eventId:event.id,actionId:action.id,recordId:id,assigneeId:employee.id}}});
  }return ids;
 });
}

export async function claimRuleEvent(tx:any,tenantId:string,rule:{id:string;revision:number},eventId:string,at=new Date().toISOString()){
 const settingKey='CUSTOM_RULE_EVENT:'+createHash('sha256').update(eventId).digest('hex'),where={tenantId_settingKey:{tenantId,settingKey}},claimed=(await tx.tenantSetting.findUnique({where}))?.value;
 if(claimed?.stoppedAt)return false;
 if(claimed)return claimed.ruleId===rule.id&&claimed.revision===rule.revision;
 await tx.tenantSetting.create({data:{tenantId,settingKey,value:{eventId,ruleId:rule.id,revision:rule.revision,selectedAt:at}}});return true;
}
export async function claimRuleMessage(client:any,tenantId:string,rule:{id:string;revision:number},eventId:string){
 return client.$transaction(async(tx:any)=>{await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;const saved=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOM_RULE:'+rule.id}}}))?.value;if(saved?.state!=='ACTIVE'||saved.revision!==rule.revision)return false;return claimRuleEvent(tx,tenantId,rule,eventId);});
}
