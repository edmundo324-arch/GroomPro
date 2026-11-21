import {conversationPrefix,conversationRule} from './customer-conversations';
import {loadBookingRulePlan} from './custom-rule-booking-event';
import {unfinishedBookingPrefix} from './unfinished-bookings';
import {readPortalPolicy} from './portal-policy-store';
import {selectCustomerRule} from './custom-rule-pet-targets';
import {customRuleDraft,customRulePrefix} from './custom-rule-policy';
import {selectCustomRule} from './custom-rule-plan';
import {loadMembershipRuleEvent} from './custom-rule-membership-event';
import {loadBalanceRuleEvent} from './custom-rule-balance-event';
import {followUpClaimKey} from './ticket-follow-ups';

export async function customerFollowUps(tx:any,tenantId:string,customerId:string){
 const customer=await tx.customer.findFirst({where:{tenantId,id:customerId},select:{id:true,active:true}});
 if(!customer)throw Error('This customer is unavailable. Reopen their profile from Customers.');
 if(customer.active===false)return {rows:[],customerId};
 const saved=await tx.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:customRulePrefix}},select:{value:true}});
 const rules=saved.map((r:any)=>r.value).filter((r:any)=>r?.state==='ACTIVE').map((r:any)=>({...r,...customRuleDraft(r)})),rows:any[]=[];
 async function add(context:any,timezone:string){
  const plan=await selectCustomerRule(tx,tenantId,customerId,rules,context);if(!plan)return;
  if(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:followUpClaimKey(context.id)}}}))return;
  rows.push({eventId:context.id,ruleId:plan.rule.id,revision:plan.rule.revision,name:plan.rule.name,dueAt:plan.dueAt.toISOString(),timezone});
 }
 if(rules.some((r:any)=>r.event.startsWith('MEMBERSHIP_'))){
  const audits=await tx.auditEntry.findMany({where:{tenantId,customerId,entityType:'MEMBERSHIP',action:{in:['MEMBERSHIP_STARTED','MEMBERSHIP_CANCEL','MEMBERSHIP_PAUSE','MEMBERSHIP_RESUME']}},orderBy:[{occurredAt:'desc'},{id:'desc'}]});
  const seen=new Set<string>();
  for(const audit of audits){const key=audit.entityId+':'+audit.action;if(seen.has(key))continue;seen.add(key);
   const loaded=await loadMembershipRuleEvent(tx,{id:tenantId,name:''},audit);
   if(loaded&&loaded.customerId===customerId)await add(loaded.context,loaded.timezone);
  }
 }
 if(rules.some((r:any)=>r.event==='BALANCE_DUE')){
  const entries=await tx.$queryRaw`SELECT id,customerId,createdAt,amountCents FROM CustomerAccountLedger WHERE tenantId=${tenantId} AND customerId=${customerId} AND entryType='OWED' AND amountCents>0 ORDER BY createdAt,id`;
  for(const entry of entries){const loaded=await loadBalanceRuleEvent(tx,tenantId,entry);if(loaded)await add(loaded.context,loaded.location.timezone);}
 }
 if(rules.some((r:any)=>r.event==='BOOKING_ABANDONED')){
  const policy=await readPortalPolicy(tenantId,tx),drafts=await tx.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:unfinishedBookingPrefix}}});
  for(const draft of drafts){if(draft.value?.customerId!==customerId)continue;const loaded=await loadBookingRulePlan(tx,tenantId,draft,policy,rules.filter((r:any)=>r.event==='BOOKING_ABANDONED'));if(!loaded)continue;
   const {plan,location,eventId}=loaded;if(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:followUpClaimKey(eventId)}}}))continue;
   rows.push({eventId,ruleId:plan.rule.id,revision:plan.rule.revision,name:plan.rule.name,dueAt:plan.dueAt.toISOString(),timezone:location.timezone});
  }
 }
 const threads=await tx.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:conversationPrefix}},select:{settingKey:true,value:true}});
 for(const thread of threads){const v=thread.value;if(v?.customerId!==customerId||!['PENDING','PAUSED','REVIEW'].includes(v.state))continue;
  const rule=await conversationRule(tx,tenantId,v.ruleId);rows.push({eventId:thread.settingKey,ruleId:v.ruleId,revision:v.revision,name:(rule?.name||'Offer conversation')+' — '+(v.state==='REVIEW'?'Staff review needed':v.state==='PAUSED'?'Customer requested a pause':'Reply pending'),dueAt:v.resumeAt||v.updatedAt,timezone:v.timezone||'UTC',conversation:true,detail:v.lastError||v.pauseReason||''});
 }
 return {rows:rows.sort((a,b)=>a.dueAt.localeCompare(b.dueAt)),customerId};
}

export async function stopCustomerFollowUp(client:any,tenantId:string,userId:string,input:any){
 if(typeof input.reason!=='string'||!input.reason.trim()||input.reason.trim().length>1000)throw Error('Explain why this follow-up is no longer needed. The reason stays in the customer’s history.');
 return client.$transaction(async(tx:any)=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  const current=await customerFollowUps(tx,tenantId,input.customerId),row=current.rows.find((r:any)=>r.eventId===input.eventId&&r.ruleId===input.ruleId&&r.revision===input.revision);
  if(!row)throw Error('This follow-up has changed or already started. Refresh the list; messages already submitted cannot be recalled.');
  if(row.conversation){
   await tx.$queryRaw`SELECT id FROM Customer WHERE id=${input.customerId} AND tenantId=${tenantId} FOR UPDATE`;
   const where={tenantId_settingKey:{tenantId,settingKey:row.eventId}},state=(await tx.tenantSetting.findUnique({where}))?.value;
   if(!state||state.revision!==input.revision||state.leaseUntil&&+new Date(state.leaseUntil)>Date.now())throw Error('This reply is being prepared or has changed. Refresh before stopping it.');
   const value={...state,state:'STOPPED',revision:state.revision+1,stoppedBy:userId,reason:input.reason.trim(),updatedAt:new Date().toISOString()};await tx.tenantSetting.update({where,data:{value}});
   await tx.auditEntry.create({data:{tenantId,customerId:input.customerId,actorType:'EMPLOYEE',actorUserId:userId,entityType:'CUSTOMER',entityId:input.customerId,action:'OFFER_CONVERSATION_STOPPED',summary:'Stopped this customer’s offer follow-up.',details:{ruleId:row.ruleId,reason:input.reason.trim()}}});return {stoppedAt:value.updatedAt};
  }
  const stoppedAt=new Date().toISOString(),value={eventId:row.eventId,ruleId:row.ruleId,revision:row.revision,stoppedAt,stoppedBy:userId,reason:input.reason.trim()};
  await tx.tenantSetting.create({data:{tenantId,settingKey:followUpClaimKey(row.eventId),value}});
  await tx.auditEntry.create({data:{tenantId,customerId:current.customerId,actorType:'EMPLOYEE',actorUserId:userId,entityType:'CUSTOMER',entityId:current.customerId,action:'CUSTOM_RULE_FOLLOW_UP_STOPPED',summary:'Stopped pending follow-up: '+row.name,details:value}});
  return {stoppedAt};
 });
}
