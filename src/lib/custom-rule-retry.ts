import {createHash,randomUUID} from 'node:crypto';
export const failedRuleDelivery=(status:string)=>['FAILED','UNDELIVERED','BOUNCED'].includes(status);
const key=(id:string)=>'CUSTOM_RULE_RETRY:'+createHash('sha256').update(id).digest('hex');
export async function ruleMessageAttempt(client:any,tenantId:string,baseId:string,customerId:string,rule:{id:string;revision:number}){
 const original=await client.communication.findFirst({where:{tenantId,id:baseId,customerId}});if(!original)return baseId;if(!failedRuleDelivery(original.deliveryStatus))return null;
 const request=(await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:key(baseId)}}}))?.value;
 if(!request||request.ruleId!==rule.id||request.revision!==rule.revision||request.customerId!==customerId)return null;
 const previous=await client.communication.findFirst({where:{tenantId,id:request.previousId,customerId}});
 if(!previous||!failedRuleDelivery(previous.deliveryStatus)||await client.communication.findFirst({where:{tenantId,id:request.attemptId,customerId}}))return null;
 return request.attemptId as string;
}
export async function requestRuleRetry(client:any,tenantId:string,userId:string,communicationId:string){
 return client.$transaction(async(tx:any)=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  const message=await tx.communication.findFirst({where:{tenantId,id:communicationId,direction:'OUTBOUND'}});
  if(!message||!failedRuleDelivery(message.deliveryStatus))throw Error('Only a message confirmed as failed or bounced can be retried. Check delivery results before resending.');
  if(!await tx.customer.findFirst({where:{tenantId,id:message.customerId,active:true},select:{id:true}}))throw Error('This customer is not available at this shop.');
  const meta=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOM_RULE_DELIVERY:'+communicationId}}}))?.value;
  const rule=meta&&(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOM_RULE:'+meta.ruleId}}}))?.value;
  if(!meta?.revision||rule?.state!=='ACTIVE'||rule.revision!==meta.revision)throw Error('This rule has changed or its original version is unavailable. Review the customer’s conversation before sending a new message.');
  const mapped=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOM_RULE_RETRY_BASE:'+communicationId}}}))?.value,baseId=mapped?.baseId||communicationId,where={tenantId_settingKey:{tenantId,settingKey:key(baseId)}},existing=(await tx.tenantSetting.findUnique({where}))?.value;
  if(existing&&existing.previousId===communicationId)return {message:'A retry is already requested. GroomPro will check that the message is still needed before sending.'};
  if(existing&&existing.attemptId!==communicationId)throw Error('A newer attempt exists. Refresh the activity list to review its result.');
  const attemptId='rule_retry_'+randomUUID(),value={baseId,attemptId,previousId:communicationId,customerId:message.customerId,ruleId:rule.id,revision:rule.revision,requestedAt:new Date().toISOString(),requestedBy:userId};
  await tx.tenantSetting.upsert({where,create:{tenantId,settingKey:where.tenantId_settingKey.settingKey,value},update:{value}});
  await tx.tenantSetting.create({data:{tenantId,settingKey:'CUSTOM_RULE_RETRY_BASE:'+attemptId,value:{baseId}}});
  await tx.auditEntry.create({data:{tenantId,customerId:message.customerId,actorType:'EMPLOYEE',actorUserId:userId,entityType:'CUSTOMER',entityId:message.customerId,action:'CUSTOM_RULE_RETRY_REQUESTED',summary:'Requested retry of a failed custom message.',details:value}});
  return {message:'Retry requested. GroomPro will check the current rule, customer details and whether the message is still needed before sending.'};
 });
}
