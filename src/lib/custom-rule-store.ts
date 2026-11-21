import {validatePetTargets} from './custom-rule-pet-targets';
import {db} from './db';
import {customRuleDraft,customRulePrefix,executableStaffEvents,executableMessageEvents} from './custom-rule-policy';
import {readTagCatalog} from './customer-tags';
export async function saveCustomRuleDraft(tenantId:string,actorId:string,input:any,hideOwners:boolean,client:any=db){const draft=customRuleDraft(input);return client.$transaction(async(tx:any)=>{
 await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
 const where={tenantId_settingKey:{tenantId,settingKey:customRulePrefix+draft.id}},saved=(await tx.tenantSetting.findUnique({where}))?.value;
 if((saved?.revision||0)!==draft.revision)throw Error('This rule changed elsewhere. Reopen it to review the saved version; your draft is still here.');
 if(saved&&saved.state!=='DRAFT')throw Error('This rule is not a draft. Review its active version before changing it.');
 const staffIds=[...new Set(draft.actions.flatMap(a=>a.assigneeIds))];
 const [locations,staff,catalog]=await Promise.all([tx.location.findMany({where:{tenantId,id:{in:draft.locationIds}},select:{id:true}}),tx.user.findMany({where:{tenantId,id:{in:staffIds},active:true,...(hideOwners?{role:{not:'PLATFORM_OWNER'}}:{})},select:{id:true}}),readTagCatalog(tenantId,tx)]);
 if(draft.locationIds.some(id=>!locations.some((l:any)=>l.id===id)))throw Error('Choose locations available to this business.');
 if(staffIds.some(id=>!staff.some((s:any)=>s.id===id)))throw Error('Choose active employees available to this business.');
 if(draft.conditions.tagIds.some(id=>!catalog.tags.some(t=>t.id===id&&t.active)))throw Error('Choose active customer tags from this business.');
 await validatePetTargets(tx,tenantId,draft.conditions);
 const now=new Date().toISOString(),value={...draft,state:'DRAFT',revision:draft.revision+1,createdAt:saved?.createdAt||now,createdBy:saved?.createdBy||actorId,updatedAt:now,updatedBy:actorId};
 await tx.tenantSetting.upsert({where,create:{tenantId,settingKey:customRulePrefix+draft.id,value},update:{value}});
 await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:actorId,entityType:'TENANT',entityId:tenantId,action:'CUSTOM_RULE_DRAFT_SAVED',summary:'Saved custom rule draft: '+draft.name,details:{ruleId:draft.id,revision:value.revision,event:draft.event}}});return value;
 });}

export async function changeCustomRuleState(tenantId:string,actorId:string,input:any,hideOwners:boolean,client:any=db){
 if(!['ACTIVE','DRAFT'].includes(input?.state)||typeof input.id!=='string'||!/^[a-f0-9-]{36}$/i.test(input.id)||!Number.isSafeInteger(input.revision))throw Error('Reopen this rule before changing whether it runs.');
 return client.$transaction(async(tx:any)=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  const where={tenantId_settingKey:{tenantId,settingKey:customRulePrefix+input.id}},saved=(await tx.tenantSetting.findUnique({where}))?.value;
  if(!saved||saved.revision!==input.revision)throw Error('This rule changed elsewhere. Reopen it before changing whether it runs.');
  const draft=customRuleDraft(saved);
  if(input.state==='ACTIVE'){
   if(saved.state==='ACTIVE')throw Error('This rule is already on. Reopen it to see its current settings.');
   if(!['INCLUDE','NEW_ONLY'].includes(input.existingRecords))throw Error('Choose whether to include existing matching records before turning this rule on.');
   if(!executableStaffEvents.includes(draft.event)||draft.actions.some(a=>a.kind==='MESSAGE')&&!executableMessageEvents.includes(draft.event))throw Error('This rule can be saved, but its event or customer-message delivery is not ready to turn on yet.');
   await validatePetTargets(tx,tenantId,draft.conditions);
   const ids=[...new Set(draft.actions.flatMap(a=>a.assigneeIds))];
   const [staff,locations,catalog]=await Promise.all([tx.user.findMany({where:{tenantId,id:{in:ids},active:true,...(hideOwners?{role:{not:'PLATFORM_OWNER'}}:{})},select:{id:true}}),tx.location.findMany({where:{tenantId,id:{in:draft.locationIds}},select:{id:true}}),readTagCatalog(tenantId,tx)]);
   if(ids.some(id=>!staff.some((s:any)=>s.id===id)))throw Error('An assigned employee is no longer available. Review the recipients before turning this rule on.');
   if(draft.locationIds.some(id=>!locations.some((l:any)=>l.id===id))||draft.conditions.tagIds.some(id=>!catalog.tags.some(t=>t.id===id&&t.active)))throw Error('A selected shop or customer tag is no longer available. Review this rule first.');
  }
  const now=new Date().toISOString(),value={...saved,state:input.state,revision:saved.revision+1,updatedAt:now,updatedBy:actorId,...(input.state==='ACTIVE'?{activatedAt:now,existingRecords:input.existingRecords}:{pausedAt:now})};
  await tx.tenantSetting.upsert({where,create:{tenantId,settingKey:customRulePrefix+input.id,value},update:{value}});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:actorId,entityType:'TENANT',entityId:tenantId,action:input.state==='ACTIVE'?'CUSTOM_RULE_ENABLED':'CUSTOM_RULE_PAUSED',summary:(input.state==='ACTIVE'?'Turned on rule: ':'Paused rule: ')+draft.name,details:{ruleId:draft.id,revision:value.revision,existingRecords:value.existingRecords||null}}});return value;
 });
}
