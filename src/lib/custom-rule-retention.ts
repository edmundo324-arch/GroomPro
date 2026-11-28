import {selectCustomerRule} from './custom-rule-pet-targets';
import {customerRetention,retentionSettingKey,retentionWeeks} from './report-retention';
import {localToInstant} from './operating-hours';
import {customRuleDraft,customRulePrefix} from './custom-rule-policy';
import {selectCustomRule,type ExecutableCustomRule} from './custom-rule-plan';
import {rebookingCandidateIds} from './appointment-lifecycle-messages';
import {recordRuleStaffAction} from './custom-rule-staff-actions';

// Reuse the retention report's due date. One event per latest completed visit,
// regardless of how often the scheduler runs or the tenant edits the interval.
export async function overdueCustomerRule(client:any,ticket:any,rules?:ExecutableCustomRule[],now=new Date()){
 const tenantId=ticket.tenantId;
 if(ticket.status!=='CLOSED'||!ticket.closedAt||!ticket.customer?.active||!ticket.pets?.some((p:any)=>p.pet.active&&p.pet.customerId===ticket.customerId))return null;
 const available=rules||((await client.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:customRulePrefix}},select:{value:true}})).map((r:any)=>r.value).filter((r:any)=>r?.state==='ACTIVE'&&r.event==='CUSTOMER_OVERDUE').map((r:any)=>({...r,...customRuleDraft(r)})) as ExecutableCustomRule[]);
 if(!available.some(r=>r.event==='CUSTOMER_OVERDUE'))return null;
 const [latest,future,setting,tags,vip]=await Promise.all([
  client.ticket.findFirst({where:{tenantId,customerId:ticket.customerId,status:'CLOSED',closedAt:{lte:now},lines:{some:{lineType:'SERVICE',petId:{not:null},role:{in:['GROOM','BATH','PREP','DRY']}}}},orderBy:[{closedAt:'desc'},{id:'desc'}],include:{lines:true,customer:{select:{active:true}},pets:{include:{pet:true}}}}),
  // A pending request also means the family has already tried to book.
  client.ticket.findFirst({where:{tenantId,customerId:ticket.customerId,scheduledStart:{gt:now},status:{in:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY']}},select:{id:true}}),
  client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:retentionSettingKey}}}),
  client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOMER_TAGS:'+ticket.customerId}}}),
  client.$queryRaw`SELECT id FROM Membership WHERE tenantId=${tenantId} AND customerId=${ticket.customerId} AND status IN ('ACTIVE','CANCELLATION_REQUESTED','PAUSE_REQUESTED') LIMIT 1`
 ]);
 if(latest?.id!==ticket.id||future||!latest.customer?.active)return null;
 const owned=(record:any)=>record.pets.filter((p:any)=>p.pet.active&&p.pet.customerId===ticket.customerId).map((p:any)=>p.pet.id).sort();
 const currentPets=owned(latest);if(!currentPets.length||JSON.stringify(currentPets)!==JSON.stringify(owned(ticket)))return null;
 const weeks=setting?retentionWeeks(setting.value):6,record=customerRetention([{id:ticket.customerId}],[latest],[],weeks,now,now,now,ticket.location.timezone).rows[0];
 if(!record?.overdue||!record.dueDate)return null;
 const eventId='customer-overdue:'+ticket.id,eventAt=localToInstant(record.dueDate+'T00:00',ticket.location.timezone);
 const plan=await selectCustomerRule(client,tenantId,ticket.customerId,available,{id:eventId,event:'CUSTOMER_OVERDUE',occurredAt:eventAt.toISOString(),locationId:ticket.locationId,current:true,facts:{vipActive:!!vip.length,hasUpcomingAppointment:false,attendanceConfirmed:false,tagIds:tags?.value?.tagIds||[]}},now);
 return plan?{...plan,eventId,eventAt}:null;
}

export async function runOverdueCustomerRules(client:any,tenant:any,rules:ExecutableCustomRule[],after='',now=new Date()){
 const candidates=rules.filter(r=>r.event==='CUSTOMER_OVERDUE');if(!candidates.length)return null;
 const rows=await rebookingCandidateIds(client,tenant.id,after,now),began=Date.now();let last=after;
 for(const row of rows){if(last&&Date.now()-began>40000)return last;last=row.id;let ruleId='',customerId='';try{
  const load=(tx:any)=>tx.ticket.findFirst({where:{tenantId:tenant.id,id:row.id},include:{customer:true,location:true,pets:{include:{pet:true}}}});
  const ticket=await load(client);if(!ticket)continue;customerId=ticket.customerId;
  const plan=await overdueCustomerRule(client,ticket,candidates,now);if(!plan?.ready)continue;ruleId=plan.rule.id;
  const values={firstName:ticket.customer.firstName,location:ticket.location.name,customerName:[ticket.customer.firstName,ticket.customer.lastName].filter(Boolean).join(' '),petName:ticket.pets.filter((p:any)=>p.pet.active&&p.pet.customerId===customerId).map((p:any)=>p.pet.name).join(', '),businessName:tenant.name,balanceDue:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(ticket.customer.balanceCents)/100)};
  const validate=async(tx:any)=>{const fresh=await load(tx);return !!fresh&&fresh.customerId===customerId&&(await overdueCustomerRule(tx,fresh,candidates))?.rule.id===plan.rule.id;};
  for(const action of plan.rule.actions.filter(a=>a.kind!=='MESSAGE'))await recordRuleStaffAction(client,tenant.id,plan.rule as any,action,{id:plan.eventId,customerId,timezone:ticket.location.timezone,validate},values);
 }catch(error){const settingKey='CUSTOM_RULE_RETENTION_ERROR:'+row.id,value={customerId:customerId||null,ruleId,checkedAt:new Date().toISOString(),message:(error as Error).message};await client.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId:tenant.id,settingKey}},create:{tenantId:tenant.id,settingKey,value},update:{value}});}}
 return rows.length===100?last:null;
}
