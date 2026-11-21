import {selectCustomerRule} from './custom-rule-pet-targets';
import {loadBalanceRuleEvent} from './custom-rule-balance-event';
import {selectCustomRule,type ExecutableCustomRule} from './custom-rule-plan';
import {recordRuleStaffAction} from './custom-rule-staff-actions';
import {sendCustomRuleMessage} from './custom-rule-message';
export {outstandingIncrease} from './custom-rule-balance-event';
export async function runBalanceRules(client:any,tenant:any,rules:ExecutableCustomRule[],after='',now=new Date()){
 const candidates=rules.filter(r=>r.event==='BALANCE_DUE');if(!candidates.length)return null;
 const tenantId=tenant.id,began=Date.now();let last=after;
 const entries=await client.$queryRaw`SELECT id,customerId,createdAt,amountCents FROM CustomerAccountLedger WHERE tenantId=${tenantId} AND entryType='OWED' AND amountCents>0 AND id>${after} ORDER BY id LIMIT 100`;
 for(const entry of entries){if(last&&Date.now()-began>40000)return last;last=entry.id;let ruleId='';try{
  const loaded=await loadBalanceRuleEvent(client,tenantId,entry,now);if(!loaded)continue;
  const {customer,location,eventId,context,stillOwed}=loaded,plan=await selectCustomerRule(client,tenantId,customer.id,candidates,context,now);if(!plan?.ready)continue;ruleId=plan.rule.id;
  const values={customerName:[customer.firstName,customer.lastName].filter(Boolean).join(' '),businessName:tenant.name,balanceDue:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(customer.balanceCents)/100)};
  for(const action of plan.rule.actions.filter(a=>a.kind!=='MESSAGE'))await recordRuleStaffAction(client,tenantId,plan.rule as any,action,{id:eventId,customerId:customer.id,timezone:location.timezone,validate:stillOwed},values);
  for(const action of plan.rule.actions.filter(a=>a.kind==='MESSAGE'))await sendCustomRuleMessage(tenantId,plan.rule,action,eventId,customer.id,values,()=>stillOwed(client),client);
 }catch(error){const settingKey='CUSTOM_RULE_BALANCE_ERROR:'+entry.id,value={customerId:entry.customerId,ruleId,checkedAt:new Date().toISOString(),message:(error as Error).message};await client.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey}},create:{tenantId,settingKey,value},update:{value}});}}
 return entries.length===100?last:null;
}
