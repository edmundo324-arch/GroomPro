import {createHash,randomUUID} from 'node:crypto';
import {conversationPrefix,conversationLinkKey,offerConversationContext,conversationRule} from './customer-conversations';
import {readConversationPolicy,conversationResumeAt} from './conversation-policy';
import {interpretConversation,openAIConfigured} from './openai-conversation';
import {currentTargetNames} from './custom-rule-pet-targets';
import {customRuleMatches} from './custom-rule-policy';
import {reserveMarketingMessage} from './marketing-limit';
import {sendCustomerSms,configFor} from './sms';
import {sendCustomerEmail,customerEmailConfig} from './customer-email';
import {normalizePhone} from './phone-normalization';
import {platformRestriction} from './platform-restrictions';
import {isFeatureEnabled,customerContactFeature} from './feature-access';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function runCustomerConversations(client:any,tenant:{id:string;name:string},interpret=interpretConversation,now=new Date()){
 const tenantId=tenant.id,policy=await readConversationPolicy(client,tenantId);
 if(!policy.enabled||!openAIConfigured()||await platformRestriction(tenantId)||!await isFeatureEnabled(tenantId,'MESSAGING'))return;
 const cursorKey='CUSTOMER_OFFER_CONVERSATION_CURSOR',cursor=(await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:cursorKey}}}))?.value;
 const rows=await client.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:conversationPrefix,...(cursor?.after?{gt:cursor.after}:{})}},orderBy:{settingKey:'asc'},take:20});
 const began=Date.now();let last='';
 for(const row of rows){if(Date.now()-began>35000)break;last=row.settingKey;const state=row.value,resuming=state.state==='PAUSED'&&state.resumeAt&&+new Date(state.resumeAt)<=+now;
  if(state.state!=='PENDING'&&!resuming)continue;
  const leaseId=randomUUID(),leaseWhere={tenantId_settingKey:{tenantId,settingKey:row.settingKey}};
  const claimed=await client.$transaction(async(tx:any)=>{
   await tx.$queryRaw`SELECT id FROM Customer WHERE id=${state.customerId} AND tenantId=${tenantId} FOR UPDATE`;
   const current=(await tx.tenantSetting.findUnique({where:leaseWhere}))?.value;
   if(!current||current.revision!==state.revision||current.incomingId!==state.incomingId||current.leaseUntil&&+new Date(current.leaseUntil)>Date.now())return false;
   await tx.tenantSetting.update({where:leaseWhere,data:{value:{...current,leaseId,leaseUntil:new Date(Date.now()+300000).toISOString()}}});return true;
  });if(!claimed)continue;
  const attemptId='conversation_'+createHash('sha256').update(row.settingKey+':'+state.incomingId+':'+(resuming?'resume':'reply')).digest('hex');
  const update=async(patch:any)=>client.$transaction(async(tx:any)=>{
   await tx.$queryRaw`SELECT id FROM Customer WHERE id=${state.customerId} AND tenantId=${tenantId} FOR UPDATE`;
   const where={tenantId_settingKey:{tenantId,settingKey:row.settingKey}},current=(await tx.tenantSetting.findUnique({where}))?.value;
   if(current?.revision!==state.revision||current.incomingId!==state.incomingId||current.leaseId!==leaseId)return false;
   const value={...current,...patch};await tx.tenantSetting.update({where,data:{value}});
   if(patch.state&&patch.state!==current.state)await tx.auditEntry.create({data:{tenantId,actorType:'SYSTEM',entityType:'CUSTOMER',entityId:state.customerId,customerId:state.customerId,action:'OFFER_CONVERSATION_UPDATED',summary:'Updated this customer’s offer conversation.',details:{ruleId:state.ruleId,before:current.state,after:patch.state,resumeAt:patch.resumeAt||null,incomingId:state.incomingId}}});return true;
  });
  try{
   const context=await offerConversationContext(client,tenantId,state);if(!context){await update({state:'REVIEW',lastError:'The customer, shop or original conversation needs staff review.'});continue;}
   const {customer,root,incoming,rule,location,history}=context;
   if(!rule||rule.state!=='ACTIVE'||rule.revision!==state.ruleRevision){await update({state:'REVIEW',lastError:'The offer rule changed. Review the conversation before following up.'});continue;}
   const [upcoming,vip,tags]=await Promise.all([client.ticket.findFirst({where:{tenantId,customerId:customer.id,scheduledStart:{gt:now},status:{in:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY']},bookingDecision:{not:'REJECTED'}},select:{id:true}}),client.$queryRaw`SELECT id FROM Membership WHERE tenantId=${tenantId} AND customerId=${customer.id} AND status IN ('ACTIVE','CANCELLATION_REQUESTED','PAUSE_REQUESTED') LIMIT 1`,client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOMER_TAGS:'+customer.id}}})]);
   const completedSinceOffer=await client.ticket.findFirst({where:{tenantId,customerId:customer.id,status:'CLOSED',closedAt:{gt:new Date(root.createdAt)}},select:{id:true}});
   const names=await currentTargetNames(client,tenantId,customer.id,rule);
   if(resuming&&(upcoming||completedSinceOffer||names===null||!customRuleMatches(rule,{vipActive:!!vip.length,hasUpcomingAppointment:!!upcoming,attendanceConfirmed:false,tagIds:tags?.value?.tagIds||[]})||rule.locationIds?.length&&!rule.locationIds.includes(location.id))){await update({state:'FINISHED',lastError:null,resolution:'No follow-up needed: booking or offer eligibility changed.'});continue;}
   const newer=history.some((m:any)=>m.speaker==='shop'&&new Date(m.date)>new Date(incoming.createdAt)&&m.id!==attemptId);
   if(!resuming&&newer){await update({state:'REVIEW',lastError:'A newer shop message exists. Review the conversation before an AI reply.'});continue;}
   const phone=customer.phones?.find((p:any)=>p.smsEnabled&&normalizePhone(p.number)===normalizePhone(state.fromAddress||''));
   if(state.channel==='SMS'&&(!phone||customer.appointmentSms===false||customer.invalidSmsNumber)||state.channel==='EMAIL'&&(!customer.email||customer.appointmentEmail===false||customer.invalidEmail||customer.email.toLowerCase()!==String(state.fromAddress).toLowerCase())){await update({state:'REVIEW',lastError:'Contact details or communication preferences changed.'});continue;}
   if(state.channel==='SMS'&&(!configFor(tenantId)||!await isFeatureEnabled(tenantId,customerContactFeature))||state.channel==='EMAIL'&&!customerEmailConfig(tenantId))continue;
   let proposal=state.proposal?.attemptId===attemptId?state.proposal:null;
   if(!proposal){
    const decision=await interpret({mode:resuming?'RESUME':'REPLY',business:tenant.name,customerFirstName:customer.firstName,petNames:customer.pets.map((p:any)=>p.name),shop:location.name,timezone:location.timezone,localToday:now.toLocaleDateString('en-CA',{timeZone:location.timezone}),offer:{text:root.body,sentAt:root.createdAt,ruleName:rule.name},previousPause:state.pauseReason||null,currentMessage:incoming.body,history});
    if(decision.intent==='STAFF'||resuming&&decision.intent!=='CONTINUE'){await update({state:'REVIEW',lastError:decision.reason||'This conversation needs staff review.'});continue;}
    let resumeAt:string|null=null,body=decision.reply,nextState=resuming?'FINISHED':'OPEN';
    if(!resuming&&['PAUSE_NEXT_MONTH','PAUSE_UNTIL'].includes(decision.intent)){
     resumeAt=conversationResumeAt(decision.intent,decision.date,decision.time,new Date(root.createdAt),new Date(incoming.createdAt),location.timezone,policy).toISOString();
     body=policy.pauseText.replaceAll('{date}',new Date(resumeAt).toLocaleDateString('en-US',{timeZone:location.timezone,month:'long',day:'numeric',year:'numeric'})).replaceAll('{business}',tenant.name).replaceAll('{customer}',customer.firstName);nextState='PAUSED';
    }
    if(!resuming&&decision.intent==='STOP_OFFER'){body=policy.stopText.replaceAll('{business}',tenant.name).replaceAll('{customer}',customer.firstName).replaceAll('{date}','');nextState='STOPPED';}
    if(!body.trim()){await update({state:'REVIEW',lastError:'A useful reply could not be prepared.'});continue;}
    proposal={attemptId,body,nextState,resumeAt,reason:decision.reason};
    if(!await update({proposal,timezone:location.timezone}))continue;
   }
   const live=(await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:row.settingKey}}}))?.value;
   if(live?.revision!==state.revision||live.incomingId!==state.incomingId||live.leaseId!==leaseId)continue;
   const currentRule=await conversationRule(client,tenantId,state.ruleId);
   if(currentRule?.state!=='ACTIVE'||currentRule.revision!==state.ruleRevision){await update({state:'REVIEW',lastError:'The offer changed while this reply was being prepared.'});continue;}
   const livePolicy=await readConversationPolicy(client,tenantId);if(!livePolicy.enabled)continue;if(livePolicy.revision!==policy.revision){await update({state:'REVIEW',lastError:'Conversation settings changed while this reply was being prepared.'});continue;}
   if(resuming){
    const [currentVip,currentTags]=await Promise.all([client.$queryRaw`SELECT id FROM Membership WHERE tenantId=${tenantId} AND customerId=${customer.id} AND status IN ('ACTIVE','CANCELLATION_REQUESTED','PAUSE_REQUESTED') LIMIT 1`,client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOMER_TAGS:'+customer.id}}})]);
    const currentFacts={vipActive:!!currentVip.length,hasUpcomingAppointment:false,attendanceConfirmed:false,tagIds:currentTags?.value?.tagIds||[]};
    const booked=await client.ticket.findFirst({where:{tenantId,customerId:customer.id,scheduledStart:{gt:new Date()},status:{in:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY']},bookingDecision:{not:'REJECTED'}},select:{id:true}});
    if(booked||!customRuleMatches(currentRule,currentFacts)||await currentTargetNames(client,tenantId,customer.id,currentRule)===null){await update({state:'FINISHED',resolution:'No follow-up needed: booking or offer eligibility changed.'});continue;}
   }
   const existing=await client.communication.findFirst({where:{tenantId,id:attemptId,customerId:customer.id}});
   if(!existing&&resuming&&!(await reserveMarketingMessage(client,tenantId,customer.id,attemptId,now)).allowed)continue;
   await client.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey:conversationLinkKey(attemptId)}},create:{tenantId,settingKey:conversationLinkKey(attemptId),value:{threadKey:row.settingKey,customerId:customer.id}},update:{}});
   const sent=existing?{communication:existing}:state.channel==='SMS'?await sendCustomerSms({tenantId,customerId:customer.id,phoneId:phone.id,subject:'Your conversation with '+tenant.name,body:proposal.body,operation:{id:attemptId,expectedPhone:state.fromAddress}}):await sendCustomerEmail({tenantId,customerId:customer.id,body:proposal.body,appointmentMessage:true,document:{id:attemptId,subject:'Your conversation with '+tenant.name,expectedEmail:customer.email,html:'<p>'+escape(proposal.body).replace(/\n/g,'<br>')+'</p>'}});
   const accepted=['QUEUED','ACCEPTED','SENT','DELIVERED','READ'].includes(sent.communication.deliveryStatus);
   await update({state:accepted?proposal.nextState:'REVIEW',resumeAt:proposal.resumeAt,pauseReason:proposal.reason,pauseMessageId:state.incomingId,lastReplyId:attemptId,lastError:accepted?null:'Review this reply’s delivery result before sending again.',updatedAt:new Date().toISOString()});
  }catch(error){await update({state:'REVIEW',lastError:(error as Error).message});}
  finally{await client.$transaction(async(tx:any)=>{await tx.$queryRaw`SELECT id FROM Customer WHERE id=${state.customerId} AND tenantId=${tenantId} FOR UPDATE`;const current=(await tx.tenantSetting.findUnique({where:leaseWhere}))?.value;if(current?.leaseId===leaseId)await tx.tenantSetting.update({where:leaseWhere,data:{value:{...current,leaseId:null,leaseUntil:null}}});});}
  if(Date.now()-began>35000)break;
 }
 const value={after:rows.length===20||last&&last!==rows.at(-1)?.settingKey?last:''};await client.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey:cursorKey}},create:{tenantId,settingKey:cursorKey,value},update:{value}});
}

export async function runConversationTenant(client:any,afterTenantId:string|null=null){
 const tenant=await client.tenant.findFirst({where:afterTenantId?{id:{gt:afterTenantId}}:{},orderBy:{id:'asc'},select:{id:true,name:true}});
 if(!tenant)return {cursor:null};
 await runCustomerConversations(client,tenant);return {cursor:tenant.id};
}
