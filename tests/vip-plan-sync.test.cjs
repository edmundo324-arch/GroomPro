require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {vipSyncChoices,syncVipPlanMembers}=require('../src/lib/vip-plan-sync.ts');
const now=new Date('2026-11-27T12:00:00Z');
const before={planId:'wash-vip',name:'Full-Wash VIP',description:'One wash',priceCents:5000,items:[{serviceId:'wash',quantity:1,role:'BATH'}],billingDay:15};
const after={...before,description:'Two washes',priceCents:6000,items:[{serviceId:'wash',quantity:2,role:'BATH'}]};
const copy=value=>structuredClone(value);

function fixture({members,plans,charges}={}){
 const people=copy(members||[{id:'member',tenantId:'shop',customerId:'family',name:before.name,status:'ACTIVE',recurringPriceCents:5000}]);
 const payments=copy(charges||[]),settings=new Map(),audits=[],calls=[],created=[];
 const key=(tenantId,settingKey)=>tenantId+'\0'+settingKey;
 for(const row of plans||[{tenantId:'shop',settingKey:'MEMBERSHIP_PLAN:member',value:before}])settings.set(key(row.tenantId,row.settingKey),copy(row));
 const tx={
  tenantSetting:{
   findMany:async({where,orderBy})=>{calls.push('plans');assert.equal(where.tenantId,'shop');assert.equal(where.settingKey.startsWith,'MEMBERSHIP_PLAN:');assert.deepEqual(orderBy,{settingKey:'asc'});return [...settings.values()].filter(r=>r.tenantId===where.tenantId&&r.settingKey.startsWith(where.settingKey.startsWith)).sort((a,b)=>a.settingKey.localeCompare(b.settingKey)).map(copy)},
   findUnique:async({where})=>{calls.push('setting');const k=where.tenantId_settingKey;return copy(settings.get(key(k.tenantId,k.settingKey))||null)},
   create:async({data})=>{calls.push('create-setting');const k=key(data.tenantId,data.settingKey);assert.equal(settings.has(k),false,'Do not replace the original enrollment snapshot');settings.set(k,copy(data));created.push(copy(data));return copy(data)},
   update:async({where,data})=>{calls.push('update-setting');const k=where.tenantId_settingKey,id=key(k.tenantId,k.settingKey);assert.ok(settings.has(id));const next={...settings.get(id),...copy(data)};settings.set(id,next);return copy(next)}
  },
  $queryRaw:async(strings,...values)=>{
   const sql=strings.join('?');calls.push(sql);
   if(sql.startsWith('SELECT * FROM Membership WHERE')){
    assert.match(sql,/WHERE id=\? AND tenantId=\? FOR UPDATE$/);
    return people.filter(m=>m.id===values[0]&&m.tenantId===values[1]).map(copy);
   }
   if(sql.startsWith('SELECT id,amountCents,taxCents FROM MembershipPayment')){
    assert.match(sql,/tenantId=\? AND membershipId=\? AND status='PENDING' AND processedAt IS NULL AND scheduledFor>\? AND paymentType<>'START_VIP' FOR UPDATE$/);
    return payments.filter(p=>p.tenantId===values[0]&&p.membershipId===values[1]&&p.status==='PENDING'&&p.processedAt===null&&+new Date(p.scheduledFor)>+values[2]&&p.paymentType!=='START_VIP').map(({id,amountCents,taxCents})=>({id,amountCents,taxCents}));
   }
   throw Error('Unexpected read: '+sql);
  },
  $executeRaw:async(strings,...values)=>{
   const sql=strings.join('?');calls.push(sql);
   if(sql.startsWith('UPDATE MembershipPayment')){
    assert.match(sql,/WHERE id=\? AND tenantId=\? AND membershipId=\? AND status='PENDING' AND processedAt IS NULL AND scheduledFor>\?$/);
    const p=payments.find(p=>p.id===values[1]&&p.tenantId===values[2]&&p.membershipId===values[3]&&p.status==='PENDING'&&p.processedAt===null&&+new Date(p.scheduledFor)>+values[4]);
    if(!p)return 0;p.amountCents=values[0];return 1;
   }
   if(sql.startsWith('UPDATE Membership SET recurringPriceCents=')){
    assert.match(sql,/WHERE id=\? AND tenantId=\?$/);const m=people.find(m=>m.id===values[1]&&m.tenantId===values[2]);if(!m)return 0;m.recurringPriceCents=values[0];return 1;
   }
   if(sql.startsWith('UPDATE Membership SET name=')){
    assert.match(sql,/WHERE id=\? AND tenantId=\?$/);const m=people.find(m=>m.id===values[1]&&m.tenantId===values[2]);if(!m)return 0;m.name=values[0];return 1;
   }
   throw Error('Unexpected write: '+sql);
  },
  auditEntry:{create:async({data})=>{audits.push(copy(data));return data}}
 };
 return {tx,people,payments,settings,audits,calls,created,plan:(id='member',tenant='shop')=>settings.get(key(tenant,'MEMBERSHIP_PLAN:'+id))?.value,enrollment:(id='member')=>settings.get(key('shop','MEMBERSHIP_ENROLLMENT_PLAN:'+id))?.value};
}
const sync=(f,choices,next=after)=>syncVipPlanMembers(f.tx,'shop','manager','wash-vip',before,next,vipSyncChoices(choices),now);
const charge=(id,changes={})=>({id,tenantId:'shop',membershipId:'member',amountCents:5000,taxCents:0,status:'PENDING',processedAt:null,scheduledFor:'2026-12-01T12:00:00Z',paymentType:'CARD_ON_FILE',...changes});

test('VIP benefits and price choices are independent booleans; no selection performs no reads',async()=>{
 assert.deepEqual(vipSyncChoices({}),{updateVipBenefits:false,updateVipPrice:false});
 for(const name of ['updateVipBenefits','updateVipPrice'])for(const value of ['true',1,null,{}])assert.throws(()=>vipSyncChoices({[name]:value}),/Choose separately/);
 const noCalls=new Proxy({},{get(){throw Error('No database reads are allowed without a sync choice')}});
 const result=await syncVipPlanMembers(noCalls,'shop','manager','wash-vip',before,after,vipSyncChoices({}),now);
 assert.deepEqual(result,{vipBenefitsUpdated:0,vipPricesUpdated:0,vipScheduledChargesUpdated:0,vipChargesForReview:0});
});

test('benefits-only updates included services but preserves the member price, billing choice and pending charges',async()=>{
 const f=fixture({charges:[charge('future')]});const result=await sync(f,{updateVipBenefits:true});
 assert.equal(result.vipBenefitsUpdated,1);assert.equal(result.vipPricesUpdated,0);
 assert.deepEqual(f.plan().items,after.items);assert.equal(f.plan().description,after.description);assert.equal(f.plan().priceCents,5000);assert.equal(f.plan().billingDay,15);
 assert.equal(f.people[0].recurringPriceCents,5000);assert.equal(f.payments[0].amountCents,5000);
 assert.ok(!f.calls.some(call=>call.includes('MembershipPayment')));assert.equal(f.audits.length,1);
 assert.deepEqual(f.enrollment(),before);assert.equal(f.audits[0].details.priceChanged,false);
});

test('price-only preserves benefits and updates only future, standard, untaxed, unprocessed charges',async()=>{
 const charges=[charge('standard'),charge('custom',{amountCents:4300}),charge('taxed',{taxCents:400}),charge('paid',{status:'PAID',processedAt:'2026-11-26T12:00:00Z'}),charge('past',{scheduledFor:'2026-11-26T12:00:00Z'}),charge('due-now',{scheduledFor:now.toISOString()}),charge('processed',{processedAt:'2026-11-26T12:00:00Z'}),charge('activation',{paymentType:'START_VIP',amountCents:100}),charge('other-member',{membershipId:'other'}),charge('other-shop',{tenantId:'elsewhere'}),charge('cancelled',{status:'CANCELLED'})];
 const f=fixture({charges});const result=await sync(f,{updateVipPrice:true});
 assert.deepEqual(result,{vipBenefitsUpdated:0,vipPricesUpdated:1,vipScheduledChargesUpdated:1,vipChargesForReview:2});
 assert.equal(f.plan().priceCents,6000);assert.equal(f.people[0].recurringPriceCents,6000);assert.deepEqual(f.plan().items,before.items);assert.equal(f.plan().description,before.description);
 for(let i=0;i<charges.length;i++)assert.deepEqual(f.payments[i],charges[i].id==='standard'?{...charges[i],amountCents:6000}:charges[i]);
 assert.deepEqual(f.enrollment(),before);assert.equal(f.audits.length,1);
 assert.equal(f.audits[0].details.previousPriceCents,5000);assert.equal(f.audits[0].details.newPriceCents,6000);assert.equal(f.audits[0].details.chargesForReview,2);
 // No signed-document or activation-ticket API exists in this fixture: touching
 // either would throw instead of silently passing as an unused mock.
});

test('combined sync archives enrollment once, audits each actual change, and is repeat-safe',async()=>{
 const f=fixture({charges:[charge('future')]});
 assert.deepEqual(await sync(f,{updateVipBenefits:true,updateVipPrice:true}),{vipBenefitsUpdated:1,vipPricesUpdated:1,vipScheduledChargesUpdated:1,vipChargesForReview:0});
 assert.deepEqual(f.plan(),after);assert.equal(f.created.length,1);assert.deepEqual(f.enrollment(),before);
 assert.deepEqual(await sync(f,{updateVipBenefits:true,updateVipPrice:true}),{vipBenefitsUpdated:0,vipPricesUpdated:0,vipScheduledChargesUpdated:0,vipChargesForReview:0});
 assert.equal(f.audits.length,1);assert.equal(f.created.length,1);
 const newer={...after,priceCents:7000};await sync(f,{updateVipPrice:true},newer);
 assert.equal(f.created.length,1);assert.deepEqual(f.enrollment(),before);assert.equal(f.audits.length,2);assert.equal(f.payments[0].amountCents,7000);
 for(const audit of f.audits){assert.equal(audit.tenantId,'shop');assert.equal(audit.actorUserId,'manager');assert.equal(audit.entityId,'member');assert.equal(audit.customerId,'family');assert.equal(audit.action,'VIP_PLAN_SYNC')}
});

test('only current memberships in the selected shop and plan are synchronized',async()=>{
 const statuses=['ACTIVE','PAUSED','PAUSE_REQUESTED','CANCELLATION_REQUESTED','CANCELLED','ENDED'];
 const members=statuses.map((status,index)=>({id:'m'+index,tenantId:'shop',customerId:'family'+index,status,name:before.name,recurringPriceCents:5000}));
 members.push({id:'other-plan',tenantId:'shop',status:'ACTIVE',recurringPriceCents:5000},{id:'foreign',tenantId:'elsewhere',status:'ACTIVE',recurringPriceCents:5000});
 const plans=members.map(m=>({tenantId:m.tenantId,settingKey:'MEMBERSHIP_PLAN:'+m.id,value:{...before,planId:m.id==='other-plan'?'groom-vip':before.planId}}));
 plans.push({tenantId:'shop',settingKey:'MEMBERSHIP_PLAN:deleted',value:before});
 const f=fixture({members,plans});const result=await sync(f,{updateVipBenefits:true,updateVipPrice:true});
 assert.equal(result.vipBenefitsUpdated,4);assert.equal(result.vipPricesUpdated,4);assert.equal(f.audits.length,4);
 for(let i=0;i<members.length;i++){const updated=i<4;assert.equal(f.people[i].recurringPriceCents,updated?6000:5000);assert.deepEqual(f.plan(members[i].id,members[i].tenantId).items,updated?after.items:before.items)}
 assert.ok(!f.settings.has('shop\0MEMBERSHIP_ENROLLMENT_PLAN:deleted'));
});

test('first-billing commission keeps the original enrollment service attribution after a plan sync',async()=>{
 const exports={},calculations=[],serviceReads=[],settingReads=[];
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/membership-commission.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,require:name=>{
  assert.equal(name,'./compensation-rules');return {validateCompensation:value=>value,calculateCommission:input=>{calculations.push(input);return {commissionCents:123}}};
 }});
 const tx={
  $queryRaw:async(strings)=>{const sql=strings.join('?');if(sql.startsWith('SELECT p.*'))return [{id:'paid',membershipId:'member',amountCents:6000,processedAt:now}];if(sql.startsWith('SELECT id FROM MembershipPayment'))return [{id:'paid'}];return []},
  tenantSetting:{findUnique:async({where})=>{const key=where.tenantId_settingKey;assert.equal(key.tenantId,'shop');settingReads.push(key.settingKey);if(key.settingKey==='MEMBERSHIP_ENROLLMENT_PLAN:member')return {value:{planId:'wash-vip',items:[{serviceId:'original-service'}]}};if(key.settingKey==='MEMBERSHIP_PLAN:member')return {value:{planId:'wash-vip',items:[{serviceId:'new-service'}]}};return null},create:async({data})=>data},
  ticketLine:{findFirst:async()=>({assignedUserId:'seller',ticketId:'enrollment-ticket',assignedUser:{role:'SALES',compensationRules:{}}})},
  service:{findMany:async({where})=>{serviceReads.push(where);return [{id:where.id.in[0],code:'original-code',category:'Full Wash'}]}}
 };
 const award=await exports.recordFirstBillingCommission(tx,'shop','paid');
 assert.equal(award.amountCents,123);assert.equal(award.userId,'seller');assert.equal(serviceReads[0].tenantId,'shop');assert.equal(serviceReads[0].id.in[0],'original-service');
 assert.equal(settingReads.includes('MEMBERSHIP_PLAN:member'),false);assert.equal(calculations[0].keys.includes('original-service'),true);assert.equal(calculations[0].keys.includes('new-service'),false);
});
