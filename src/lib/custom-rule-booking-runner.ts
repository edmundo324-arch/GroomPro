import {loadBookingRulePlan} from './custom-rule-booking-event';
import {unfinishedBookingPrefix,unfinishedBookingDue} from './unfinished-bookings';
import {readPortalPolicy} from './portal-policy-store';
import {readAppointmentMessageSettings} from './appointment-message-store';
import {type ExecutableCustomRule} from './custom-rule-plan';
import {recordRuleStaffAction} from './custom-rule-staff-actions';
import {sendCustomRuleMessage} from './custom-rule-message';
export async function runUnfinishedBookingRules(client:any,tenant:any,rules:ExecutableCustomRule[],after='',now=new Date()){
 const candidates=rules.filter(r=>r.event==='BOOKING_ABANDONED');if(!candidates.length)return null;
 const tenantId=tenant.id,policy=await readPortalPolicy(tenantId,client),began=Date.now();let last=after;
 const rows=await client.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:unfinishedBookingPrefix,...(after?{gt:after}:{})}},orderBy:{settingKey:'asc'},take:100});
 for(const row of rows){if(last&&Date.now()-began>40000)return last;last=row.settingKey;let ruleId='';try{
  const value=row.value;if(!unfinishedBookingDue(value,policy.unfinishedBookingMinutes,now))continue;
  const loaded=await loadBookingRulePlan(client,tenantId,row,policy,candidates,now);if(!loaded)continue;const {plan,customer,location,pets,eventId}=loaded;if(!plan?.ready)continue;ruleId=plan.rule.id;
  const current=async(tx:any)=>{const saved=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:row.settingKey}}}))?.value;return saved?.customerId===customer.id&&saved?.locationId===location.id&&saved?.lastActivityAt===value.lastActivityAt&&unfinishedBookingDue(saved,policy.unfinishedBookingMinutes,new Date());};
  const values={firstName:customer.firstName,location:location.name,customerName:[customer.firstName,customer.lastName].filter(Boolean).join(' '),businessName:tenant.name,...(pets.length?{petName:pets.map((p:any)=>p.name).join(', ')}:{}),balanceDue:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(customer.balanceCents)/100)};
  for(const action of plan.rule.actions.filter(a=>a.kind!=='MESSAGE'))await recordRuleStaffAction(client,tenantId,plan.rule as any,action,{id:eventId,customerId:customer.id,timezone:location.timezone,validate:current},values);
  for(const action of plan.rule.actions.filter(a=>a.kind==='MESSAGE')){const settings=await readAppointmentMessageSettings(tenantId);let portalLink:string|undefined;if(settings.policy.publicOrigin){const url=new URL('/portal',settings.policy.publicOrigin);url.searchParams.set('tenant',tenantId);url.searchParams.set('location',location.id);portalLink=url.toString();}await sendCustomRuleMessage(tenantId,plan.rule,action,eventId,customer.id,{...values,...(portalLink?{portalLink}:{})},()=>current(client),client);}
 }catch(error){const settingKey='CUSTOM_RULE_BOOKING_ERROR:'+row.settingKey,value={customerId:row.value?.customerId||null,ruleId,checkedAt:new Date().toISOString(),message:(error as Error).message};await client.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey}},create:{tenantId,settingKey,value},update:{value}});}}
 return rows.length===100?last:null;
}
