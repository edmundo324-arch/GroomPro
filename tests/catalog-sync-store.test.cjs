require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {defaultTicketTax}=require('../src/lib/dog-ticket-summary.ts');
const {lineSchedule}=require('../src/lib/pet-scheduling.ts');
const {allocatePackage}=require('../src/lib/package-lines.ts');
const {promotionDisplay}=require('../src/lib/promotion-display.ts');
const clone=value=>structuredClone(value),now=new Date('2026-11-26T18:00:00Z');
const service=(patch={})=>({id:'service',tenantId:'tenant',name:'Full Wash',description:'A clean coat.',durationMin:20,priceCents:1500,workflowRole:'BATH',active:true,commissionPct:10,...patch});
function ticket(patch={}){
 const s=service();const lines=[{id:'line',ticketId:'ticket',lineType:'SERVICE',role:'BATH',serviceId:s.id,service:s,petId:'dog',productId:null,packageId:null,packageName:null,packageGroupKey:null,sourceKey:null,description:s.name,reportCardDescription:s.description,durationMin:20,quantity:1,unitPriceCents:1500,discountCents:0,totalCents:1500,commissionPct:10,commissionCents:150,assignedUserId:'bather',assignedAt:new Date('2026-11-26T15:00:00Z'),sortOrder:0}];
 return {id:'ticket',tenantId:'tenant',locationId:'location',customerId:'customer',orderNumber:42,status:'OPEN',closedAt:null,payments:[],accountCreditCents:0,scheduledStart:new Date('2026-11-27T16:00:00Z'),durationMin:20,timingMode:'SEQUENTIAL',salesTaxCents:defaultTicketTax(lines,8.25),tipCents:500,totalCents:2124,updatedAt:new Date('2026-11-20T12:00:00Z'),location:{timezone:'America/Chicago'},pets:[{petId:'dog',pet:{id:'dog',weightLbs:10}}],assignments:[{userId:'bather',role:'GROOMER'}],lines,...patch};
}
function packageTicket(){
 const before={id:'package',name:'Full Wash Bundle',basePriceCents:1500,items:[{serviceId:'service',quantity:1,role:'BATH'},{serviceId:'prep',quantity:1,role:'PREP'}]},saved=ticket();
 const amounts=allocatePackage(before.basePriceCents,before.items.map(i=>i.quantity));
 saved.lines=before.items.map((item,index)=>{const s=service(item.serviceId==='prep'?{id:'prep',name:'Prep',workflowRole:'PREP'}:{});return {...saved.lines[0],id:index?'prep-line':'line',serviceId:s.id,service:s,description:before.name+' · '+s.name,packageId:before.id,packageName:before.name,packageGroupKey:'dog:package',role:item.role,...amounts[index],commissionCents:Math.round(amounts[index].totalCents/10),sortOrder:index}});
 saved.durationMin=40;return {before,saved};
}
function fixture({tickets=[ticket()],change,settings={},starts={},onLock,available=true,discounts,eligibility='eligible',packages}={}){
 const records=new Map(tickets.map(t=>[t.id,clone(t)])),events=[],writes=[],audits=[],locked=new Set(),metadata=new Map(Object.entries(settings));
 metadata.set('WORKFLOW',{posLayout:{automaticNewTicketTax:true,taxRatePct:8.25}});
 const assertTenant=tenantId=>assert.equal(tenantId,'tenant');
 const write=(type,value)=>{writes.push({type,value:clone(value)});events.push(type)};
 const lineById=id=>[...records.values()].flatMap(t=>t.lines).find(l=>l.id===id);
 const tx={
  $queryRaw:async(strings,...values)=>{assert.match(strings.join('?'),/Ticket.*tenantId.*FOR UPDATE/);assertTenant(values[1]);locked.add(values[0]);events.push('lock:'+values[0]);onLock?.(records.get(values[0]));return []},
  ticket:{
   findMany:async q=>{assertTenant(q.where.tenantId);assert.deepEqual(q.where.status.notIn,['CLOSED','CANCELLED','NO_SHOW']);assert.equal(q.where.closedAt,null);if(change?.kind==='packages')assert.deepEqual(q.where.lines.some,{OR:[{packageId:change.before.id},{packageId:null,OR:[{packageName:change.before.name},{description:{startsWith:change.before.name+' · '}}]}]});events.push('candidates');return [...records.values()].map(({id})=>({id}))},
   findFirst:async q=>{assertTenant(q.where.tenantId);assert.ok(locked.has(q.where.id),'Ticket must be locked before rereading');events.push('read:'+q.where.id);const row=records.get(q.where.id);return row?.tenantId===q.where.tenantId?clone(row):null},
   update:async q=>{assert.ok(locked.has(q.where.id));write('ticket.update',q);const row=records.get(q.where.id);Object.assign(row,clone(q.data),{updatedAt:new Date('2026-11-26T18:00:01Z')});return clone(row)}
  },
  ticketLine:{
   updateMany:async q=>{assertTenant(q.where.ticket.tenantId);write('line.snapshots',q);let count=0;for(const row of records.values())if(row.tenantId===q.where.ticket.tenantId)for(const line of row.lines)if(line.serviceId===q.where.serviceId&&Object.keys(q.data).every(field=>line[field]==null)){Object.assign(line,clone(q.data));count++}return {count}},
   update:async q=>{const line=lineById(q.where.id);assert.ok(line&&locked.has(line.ticketId));write('line.update',q);Object.assign(line,clone(q.data));return clone(line)},
   create:async q=>{assert.ok(locked.has(q.data.ticketId));write('line.create',q);records.get(q.data.ticketId).lines.push(clone(q.data));return clone(q.data)},
   deleteMany:async q=>{assert.ok(locked.has(q.where.ticketId));write('line.delete',q);const row=records.get(q.where.ticketId);row.lines=row.lines.filter(l=>!q.where.id.in.includes(l.id));return {}},
   findMany:async q=>{assert.ok(locked.has(q.where.ticketId));events.push('read.finalLines');return clone(records.get(q.where.ticketId).lines)}
  },
  tenantSetting:{
   findUnique:async q=>{assertTenant(q.where.tenantId_settingKey.tenantId);events.push('setting:'+q.where.tenantId_settingKey.settingKey);const value=metadata.get(q.where.tenantId_settingKey.settingKey);return value===undefined?null:{value:clone(value)}},
   upsert:async q=>{assertTenant(q.where.tenantId_settingKey.tenantId);write('setting.upsert',q);metadata.set(q.where.tenantId_settingKey.settingKey,clone(q.update.value));return {}},
   update:async q=>{assertTenant(q.where.tenantId_settingKey.tenantId);write('setting.update',q);metadata.set(q.where.tenantId_settingKey.settingKey,clone(q.data.value));return {}},
   deleteMany:async q=>{assertTenant(q.where.tenantId);write('setting.delete',q);return {}}
  },
  service:{findMany:async q=>{assertTenant(q.where.tenantId);events.push('read.services');return [service(),service({id:'prep',name:'Prep',workflowRole:'PREP'})]}},
  package:{findMany:async q=>{assertTenant(q.where.tenantId);assert.equal(q.include.items.include.service,true);assert.deepEqual(q.include.items.orderBy,{sortOrder:'asc'});events.push('read.packages');return clone(packages??(change?.kind==='packages'?[change.before]:[]))}},
  locationServicePricing:{findMany:async q=>{assertTenant(q.where.tenantId);assert.equal(q.where.serviceId,'service');assert.equal(q.where.active,true);return []}},
  locationPackagePricing:{findMany:async q=>{assertTenant(q.where.tenantId);assert.equal(q.where.packageId,'package');assert.equal(q.where.active,true);return []}},
  auditEntry:{create:async q=>{assertTenant(q.data.tenantId);write('audit',q);audits.push(clone(q.data));return q.data}}
 };
 const exports={},deps={
  'node:crypto':require('node:crypto'),
  './catalog-sync':require('../src/lib/catalog-sync.ts'),
  './breed-classification':{groomingEligibility:()=>{events.push('eligibility');return {status:eligibility}}},
  './breed-store':{loadBreeds:async(client,tenantId)=>{assert.equal(client,tx);assertTenant(tenantId);return []}},
  './calendar-assignment-approval':require('../src/lib/calendar-assignment-approval.ts'),
  './pet-scheduling':require('../src/lib/pet-scheduling.ts'),
  './line-time-store':{
   readLineStarts:async(client,tenantId,id)=>{assert.equal(client,tx);assertTenant(tenantId);return clone(starts[id]||{})},
   writeLineStarts:async(client,tenantId,id,value)=>{assert.equal(client,tx);assertTenant(tenantId);write('lineTimes',{id,value});starts[id]=clone(value)}
  },
  './ticket-timing':require('../src/lib/ticket-timing.ts'),
  './pos-layout':require('../src/lib/pos-layout.ts'),
  './dog-ticket-summary':require('../src/lib/dog-ticket-summary.ts'),
  './rebooking-discount-store':{refreshRebookingDiscounts:async()=>{throw Error('Use the injected discount handler')}}
 };
 new Function('require','exports',ts.transpileModule(fs.readFileSync('src/lib/catalog-sync-store.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{assert.ok(name in deps,'Unexpected import: '+name);return deps[name]},exports);
 return {records,events,writes,audits,metadata,starts,retain:(before,after)=>exports.retainLegacyServiceSnapshots(tx,'tenant',before,after),run:scope=>exports.syncCatalogAppointments(tx,'tenant','manager',change||{kind:'services',before:service(),after:service({priceCents:2000})},scope||'ALL',{now,available:async(tenantId,userId,locationId,start,duration)=>{assertTenant(tenantId);events.push('availability');return typeof available==='function'?available({userId,locationId,start,duration}):available},discounts:async(client,tenantId,id,actor)=>{assert.equal(client,tx);assertTenant(tenantId);assert.equal(actor,'manager');events.push('discounts');await discounts?.(records.get(id));return {changed:0}}})};
}

test('none performs no reads or writes; existing VIP contracts are not changed through appointment sync',async()=>{
 const f=fixture();assert.deepEqual(await f.run('NONE'),{updated:0,unchanged:0,review:[],ticketIds:[]});assert.equal(f.events.length,0);
 const vip=fixture({change:{kind:'plans',before:{id:'vip'},after:{id:'vip'}}});await assert.rejects(vip.run(),/membership terms/);assert.equal(vip.writes.length,0);
});

test('status or payment changes between candidate discovery and ticket lock prevent all sync writes',async()=>{
 for(const patch of [{status:'CLOSED',closedAt:now},{payments:[{amount:'1.00'}]},{accountCreditCents:4500},{status:'NO_SHOW'},{status:'CANCELLED'}]){
  const f=fixture({onLock:row=>Object.assign(row,patch)}),result=await f.run();
  assert.equal(result.updated,0);assert.equal(result.unchanged,1);assert.equal(f.writes.length,0);assert.deepEqual(f.records.get('ticket').lines,ticket().lines);
 }
});

test('every query is tenant-scoped and even a foreign candidate cannot be changed',async()=>{
 const foreign=ticket({id:'foreign',tenantId:'other',orderNumber:99});foreign.lines[0].id='foreign-line';foreign.lines[0].ticketId='foreign';
 const f=fixture({tickets:[foreign]}),before=clone(f.records.get('foreign')),result=await f.run();
 assert.equal(result.updated,0);assert.equal(result.unchanged,1);assert.deepEqual(f.records.get('foreign'),before);assert.equal(f.writes.length,0);
});

test('today and future includes undated drafts but never dated past open appointments; future excludes today',async()=>{
 for(const scope of ['ALL','FUTURE'])for(const [scheduledStart,expected] of [[new Date('2026-11-25T16:00:00Z'),false],[new Date('2026-11-26T16:00:00Z'),scope==='ALL'],[new Date('2026-11-27T16:00:00Z'),true],[null,scope==='ALL']]){
  const f=fixture({tickets:[ticket({scheduledStart})]}),original=clone(f.records.get('ticket')),result=await f.run(scope);
  assert.equal(result.updated,Number(expected),`${scope}: ${scheduledStart}`);
  if(!expected){assert.equal(f.writes.length,0);assert.deepEqual(f.records.get('ticket'),original)}
 }
});

test('service repricing updates saved line, net commission, tax, total, ticket version and audit without altering staff or drop-off',async()=>{
 const f=fixture(),original=clone(f.records.get('ticket')),result=await f.run();
 assert.equal(result.updated,1);assert.deepEqual(result.ticketIds,['ticket']);assert.equal(result.review.length,0);
 const saved=f.records.get('ticket'),item=saved.lines[0];assert.equal(item.unitPriceCents,2000);assert.equal(item.totalCents,2000);assert.equal(item.commissionCents,200);assert.equal(saved.salesTaxCents,165);assert.equal(saved.totalCents,2665);assert.notEqual(+saved.updatedAt,+original.updatedAt);
 for(const field of ['scheduledStart','durationMin','assignments','tipCents'])assert.deepEqual(saved[field],original[field],field);
 for(const field of ['id','petId','assignedUserId','assignedAt','durationMin'])assert.deepEqual(item[field],original.lines[0][field],field);
 assert.equal(f.writes.filter(w=>w.type==='lineTimes').length,0);
 const ticketWrite=f.writes.find(w=>w.type==='ticket.update');assert.equal(ticketWrite.value.data.scheduledStart,undefined);assert.equal(ticketWrite.value.data.assignments,undefined);
 assert.equal(f.audits.length,1);assert.equal(f.audits[0].entityId,'ticket');assert.equal(f.audits[0].actorUserId,'manager');assert.equal(f.audits[0].action,'CATALOG_APPOINTMENT_SYNC');
});

test('separately saved tax is preserved while normal tax reflects discounted final lines',async()=>{
 const f=fixture({tickets:[ticket({salesTaxCents:17})]});await f.run();assert.equal(f.records.get('ticket').salesTaxCents,17);assert.equal(f.records.get('ticket').totalCents,2517);
 const discounted=fixture({discounts:row=>{row.lines[0].discountCents=200;row.lines[0].totalCents=1800;row.lines[0].commissionCents=180}});await discounted.run();assert.equal(discounted.records.get('ticket').salesTaxCents,149);assert.equal(discounted.records.get('ticket').totalCents,2449);
});

test('duration validation happens before any writes; unavailable work is reported intact',async()=>{
 const f=fixture({change:{kind:'services',before:service(),after:service({durationMin:40})},available:false}),before=clone(f.records.get('ticket')),result=await f.run();
 assert.equal(result.updated,0);assert.equal(result.unchanged,1);assert.match(result.review[0].reason,/availability/);assert.ok(f.events.includes('availability'));assert.equal(f.writes.length,0);assert.deepEqual(f.records.get('ticket'),before);
 const allowed=fixture({change:{kind:'services',before:service(),after:service({durationMin:40})},available:details=>{assert.equal(details.userId,'bather');assert.equal(details.locationId,'location');assert.equal(details.duration,40);return true}});
 assert.equal((await allowed.run()).updated,1);assert.ok(allowed.events.indexOf('availability')<allowed.events.indexOf('line.update'));assert.equal(allowed.records.get('ticket').durationMin,40);assert.equal(+allowed.records.get('ticket').scheduledStart,+ticket().scheduledStart);assert.equal(allowed.writes.filter(w=>w.type==='lineTimes').length,1);
});

test('duration changes cannot invalidate an existing exact scheduling approval or move an explicit start',async()=>{
 const scheduled=ticket(),start=scheduled.scheduledStart.toISOString();
 const f=fixture({change:{kind:'services',before:service(),after:service({durationMin:40})},starts:{ticket:{line:start}},settings:{'TICKET_PLANNED_PACKAGES:ticket':{items:[{petId:'dog',userId:'bather',availabilityApproval:{userId:'bather',locationId:'location',start,durationMin:20}}]}}}),original=clone(f.records.get('ticket')),result=await f.run();
 assert.equal(result.updated,0);assert.match(result.review[0].reason,/approved scheduling exception/);assert.equal(f.writes.length,0);assert.deepEqual(f.records.get('ticket'),original);assert.equal(f.events.includes('availability'),false);
});

test('a reserved resource keeps its exact reservation when changed service duration needs review',async()=>{
 const f=fixture({tickets:[ticket({bookingAssetId:'bath-station'})],change:{kind:'services',before:service(),after:service({durationMin:40})}}),original=clone(f.records.get('ticket')),result=await f.run();
 assert.equal(result.updated,0);assert.match(result.review[0].reason,/reserved-resource/);assert.equal(f.writes.length,0);assert.deepEqual(f.records.get('ticket'),original);
 const priced=fixture({tickets:[ticket({bookingAssetId:'bath-station'})]});assert.equal((await priced.run()).updated,1);assert.equal(priced.records.get('ticket').bookingAssetId,'bath-station');assert.equal(priced.records.get('ticket').durationMin,20);
});

test('a customized package leaves the entire appointment unchanged',async()=>{
 const before={id:'package',name:'Full Wash Bundle',basePriceCents:1500,items:[{serviceId:'service',quantity:1,role:'BATH'},{serviceId:'prep',quantity:1,role:'PREP'}]},s=service();
 const saved=ticket();saved.lines=[{...saved.lines[0],packageId:'package',packageName:before.name,packageGroupKey:'dog:package',description:before.name+' · '+s.name,unitPriceCents:800,totalCents:800},{...saved.lines[0],id:'prep-line',serviceId:'prep',service:service({id:'prep',name:'Prep',workflowRole:'PREP'}),packageId:'package',packageName:before.name,packageGroupKey:'dog:package',description:before.name+' · Prep',unitPriceCents:750,totalCents:750,role:'PREP',sortOrder:1}];
 const f=fixture({tickets:[saved],change:{kind:'packages',before,after:{...before,basePriceCents:1900}}}),original=clone(f.records.get('ticket')),result=await f.run();
 assert.equal(result.updated,0);assert.match(result.review[0].reason,/individual price/);assert.equal(f.writes.length,0);assert.deepEqual(f.records.get('ticket'),original);
});

test('new package eligibility is checked before changing ticket contents or prices',async()=>{
 const before={id:'package',name:'Full Wash Bundle',basePriceCents:1500,items:[{serviceId:'service',quantity:1,role:'BATH'}]},saved=ticket();Object.assign(saved.lines[0],{packageId:'package',packageName:before.name,packageGroupKey:'dog:package',description:before.name+' · Full Wash'});
 const f=fixture({tickets:[saved],eligibility:'ineligible',change:{kind:'packages',before,after:{...before,minimumWeightLbs:20,basePriceCents:1900}}}),result=await f.run();
 assert.equal(result.updated,0);assert.match(result.review[0].reason,/eligibility review/);assert.equal(f.writes.length,0);
});

test('ordinary package price and wording changes do not recheck unchanged eligibility rules',async()=>{
 for(const revision of [{basePriceCents:1900},{name:'Calm Full Wash'}]){
  const {before,saved}=packageTicket();before.minimumWeightLbs=20;before.groomingRules={coatTypes:['SMOOTH']};
  const f=fixture({tickets:[saved],eligibility:'ineligible',change:{kind:'packages',before,after:{...before,...revision}}}),result=await f.run();
  assert.equal(result.updated,1);assert.equal(result.review.length,0);assert.equal(f.events.includes('eligibility'),false);
 }
});

test('each changed package eligibility field is checked before any writes',async()=>{
 for(const revision of [{minimumWeightLbs:20},{maximumWeightLbs:5},{groomingRules:{coatTypes:['DOUBLE']}}]){
  const {before,saved}=packageTicket(),f=fixture({tickets:[saved],eligibility:'ineligible',change:{kind:'packages',before,after:{...before,...revision}}}),original=clone(f.records.get('ticket')),result=await f.run();
  assert.equal(result.updated,0);assert.match(result.review[0].reason,/eligibility/);assert.ok(f.events.includes('eligibility'));assert.equal(f.writes.length,0);assert.deepEqual(f.records.get('ticket'),original);
 }
});

test('package quantity updates save generated line starts so reopening does not shift existing work',async()=>{
 const {before,saved}=packageTicket(),originalTimes=lineSchedule(saved),f=fixture({tickets:[saved],change:{kind:'packages',before,after:{...before,items:[{...before.items[0],quantity:2},before.items[1]]}}}),result=await f.run();
 assert.equal(result.updated,1);assert.equal(f.records.get('ticket').lines[0].quantity,2);
 assert.equal(f.writes.filter(w=>w.type==='lineTimes').length,1);assert.deepEqual(f.starts.ticket,originalTimes);
 assert.deepEqual(lineSchedule({...f.records.get('ticket'),lineStarts:f.starts.ticket}),originalTimes);
 assert.equal(+f.records.get('ticket').scheduledStart,+saved.scheduledStart);
 assert.equal(f.records.get('ticket').lines.find(l=>l.id==='prep-line').assignedUserId,'bather');
});

test('package reorder persists the new row order while every original service start remains fixed',async()=>{
 const {before,saved}=packageTicket(),originalTimes=lineSchedule(saved),f=fixture({tickets:[saved],change:{kind:'packages',before,after:{...before,items:[...before.items].reverse()}}}),result=await f.run();
 assert.equal(result.updated,1);const reopened={...f.records.get('ticket'),lines:[...f.records.get('ticket').lines].sort((a,b)=>a.sortOrder-b.sortOrder),lineStarts:f.starts.ticket};
 assert.deepEqual(reopened.lines.map(l=>l.id),['prep-line','line']);assert.deepEqual(lineSchedule(reopened),originalTimes);assert.equal(+reopened.scheduledStart,+saved.scheduledStart);
});

test('removing unassigned package content preserves the remaining service start and staff',async()=>{
 const {before,saved}=packageTicket();saved.lines[0].assignedUserId=null;const originalTimes=lineSchedule(saved),f=fixture({tickets:[saved],change:{kind:'packages',before,after:{...before,items:[before.items[1]]}}}),result=await f.run();
 assert.equal(result.updated,1);const reopened=f.records.get('ticket');assert.equal(reopened.lines.length,1);assert.equal(reopened.lines[0].id,'prep-line');assert.equal(reopened.lines[0].assignedUserId,'bather');
 assert.deepEqual(f.starts.ticket,{'prep-line':originalTimes['prep-line']});assert.equal(+reopened.scheduledStart,+saved.scheduledStart);
});

test('adding package content leaves existing per-service starts and employee assignments intact',async()=>{
 const {before,saved}=packageTicket();before.items=[before.items[0]];saved.lines=[{...saved.lines[0],unitPriceCents:1500,totalCents:1500,commissionCents:150}];saved.durationMin=20;
 const explicit=new Date(+saved.scheduledStart+10*60000).toISOString(),f=fixture({tickets:[saved],starts:{ticket:{line:explicit}},change:{kind:'packages',before,after:{...before,items:[...before.items,{serviceId:'prep',quantity:1,role:'PREP'}]}}}),result=await f.run();
 assert.equal(result.updated,1);const reopened=f.records.get('ticket'),added=reopened.lines.find(l=>l.serviceId==='prep');assert.ok(added.id);assert.equal(added.assignedUserId,null);assert.equal(reopened.lines.find(l=>l.id==='line').assignedUserId,'bather');
 assert.equal(f.starts.ticket.line,explicit);assert.equal(f.starts.ticket[added.id],new Date(+new Date(explicit)+20*60000).toISOString());assert.equal(+reopened.scheduledStart,+saved.scheduledStart);
 assert.ok(f.events.indexOf('availability')<f.events.indexOf('line.create'));
});

test('legacy snapshots freeze only absent fallbacks, preserving effective history and staff-entered snapshots',async()=>{
 const legacy=ticket({status:'CLOSED',closedAt:now,payments:[{amount:'21.24'}]}),custom=ticket({id:'custom'}),foreign=ticket({id:'foreign',tenantId:'other'});
 legacy.lines[0].durationMin=null;legacy.lines[0].reportCardDescription=null;custom.lines[0].id='custom-line';custom.lines[0].ticketId='custom';custom.lines[0].durationMin=47;custom.lines[0].reportCardDescription='Staff note';foreign.lines[0].id='foreign-line';foreign.lines[0].ticketId='foreign';foreign.lines[0].durationMin=null;foreign.lines[0].reportCardDescription=null;
 const f=fixture({tickets:[legacy,custom,foreign]}),original=clone(f.records.get('ticket'));await f.retain(service(),service({durationMin:45,description:'New description'}));
 const saved=f.records.get('ticket');assert.equal(saved.lines[0].durationMin,20);assert.equal(saved.lines[0].reportCardDescription,'A clean coat.');
 assert.deepEqual({...saved,lines:original.lines},original);assert.equal(saved.lines[0].totalCents,original.lines[0].totalCents);assert.deepEqual(f.records.get('custom'),custom);assert.deepEqual(f.records.get('foreign'),foreign);assert.equal(f.writes.length,2);
 for(const write of f.writes){assert.deepEqual(Object.keys(write.value.data),Object.keys(write.value.where).filter(k=>!['serviceId','ticket'].includes(k)));assert.equal(write.value.where.ticket.tenantId,'tenant')}
 const blank=ticket();blank.lines[0].reportCardDescription=null;const blankFixture=fixture({tickets:[blank]});await blankFixture.retain(service({description:null}),service({description:'New words'}));assert.equal(blankFixture.records.get('ticket').lines[0].reportCardDescription,'');
 const unchanged=fixture();await unchanged.retain(service(),service({priceCents:2000}));assert.equal(unchanged.writes.length,0);
});

test('current promotion display snapshots follow repricing without losing a saved one-line discount',async()=>{
 const saved=ticket();Object.assign(saved.lines[0],{discountCents:150,totalCents:1350,commissionCents:135});saved.salesTaxCents=defaultTicketTax(saved.lines,8.25);
 const display=[{id:'promotion',name:'Friend Discount',mode:'SINGLE_LINE',allocations:[{lineId:'line',unitPriceCents:1500,quantity:1,discountCents:150,totalCents:1350}]}],f=fixture({tickets:[saved],settings:{'PROMOTION_DISPLAY:ticket':display}});
 assert.equal((await f.run()).updated,1);const updated=f.metadata.get('PROMOTION_DISPLAY:ticket');assert.equal(updated[0].name,'Friend Discount');assert.equal(updated[0].mode,'SINGLE_LINE');assert.deepEqual(updated[0].allocations,[{lineId:'line',unitPriceCents:2000,quantity:1,discountCents:150,totalCents:1850}]);
 assert.deepEqual(promotionDisplay(f.records.get('ticket').lines,updated).rows,[{id:'promotion',name:'Friend Discount',amountCents:150}]);assert.equal(f.writes.filter(w=>w.type==='setting.update').length,1);
});

test('stale promotion display allocations and changed discounts are never reactivated',async()=>{
 for(const kind of ['stale-price','new-discount']){
  const saved=ticket();Object.assign(saved.lines[0],{discountCents:150,totalCents:1350,commissionCents:135});const display=[{id:'promotion',allocations:[{lineId:'line',unitPriceCents:kind==='stale-price'?1400:1500,quantity:1,discountCents:150,totalCents:kind==='stale-price'?1250:1350}]}];
  const f=fixture({tickets:[saved],settings:{'PROMOTION_DISPLAY:ticket':display},discounts:kind==='new-discount'?row=>Object.assign(row.lines[0],{discountCents:200,totalCents:1800,commissionCents:180}):undefined});
  assert.equal((await f.run()).updated,1);assert.deepEqual(f.metadata.get('PROMOTION_DISPLAY:ticket'),display);assert.equal(f.writes.filter(w=>w.type==='setting.update').length,0);assert.deepEqual(promotionDisplay(f.records.get('ticket').lines,display).rows,[]);
 }
});

test('legacy package candidates use the prior catalog identity and persist IDs without losing staff or starts',async()=>{
 const {before,saved}=packageTicket();for(const line of saved.lines)Object.assign(line,{packageId:null,packageName:null,packageGroupKey:null});
 const after={...before,name:'Gentle Full Wash',basePriceCents:1900},f=fixture({tickets:[saved],packages:[after],change:{kind:'packages',before,after}}),originalTimes=lineSchedule(saved),result=await f.run();
 assert.equal(result.updated,1);assert.equal(result.review.length,0);assert.equal(f.records.get('ticket').lines.reduce((total,line)=>total+line.totalCents,0),1900);
 for(const line of f.records.get('ticket').lines){assert.equal(line.packageId,'package');assert.equal(line.packageName,'Gentle Full Wash');assert.equal(line.packageGroupKey,'dog:package');assert.equal(line.assignedUserId,'bather');assert.ok(line.description.startsWith('Gentle Full Wash · '))}
 assert.deepEqual(lineSchedule(f.records.get('ticket')),originalTimes);
});

test('service edits identify older package rows before renaming and never replace their allocated price with retail price',async()=>{
 const saved=ticket();saved.lines[0].description='Full Wash Bundle · Full Wash';
 const after=service({name:'Calm Full Wash',priceCents:2000}),packages=[{id:'package',name:'Full Wash Bundle',basePriceCents:1500,items:[{serviceId:'service',quantity:1,role:'BATH',service:after}]}],f=fixture({tickets:[saved],packages,change:{kind:'services',before:service(),after}}),result=await f.run();
 assert.equal(result.updated,1);const line=f.records.get('ticket').lines[0];assert.equal(line.unitPriceCents,1500);assert.equal(line.totalCents,1500);assert.equal(line.packageId,'package');assert.equal(line.packageGroupKey,'dog:package');assert.equal(line.description,'Full Wash Bundle · Calm Full Wash');assert.equal(line.assignedUserId,'bather');
});

test('ambiguous older package matches leave the entire ticket unchanged for staff review',async()=>{
 const saved=ticket();saved.lines[0].description='Full Wash Bundle · Full Wash';const pkg={id:'package',name:'Full Wash Bundle',items:[{serviceId:'service',service:service(),quantity:1,role:'BATH'}]},f=fixture({tickets:[saved],packages:[pkg,{...pkg,id:'same-name-package'}]}),original=clone(f.records.get('ticket')),result=await f.run();
 assert.equal(result.updated,0);assert.match(result.review[0].reason,/older package/i);assert.equal(f.writes.length,0);assert.deepEqual(f.records.get('ticket'),original);
});

test('legacy package identification happens before changed eligibility checks',async()=>{
 const {before,saved}=packageTicket();for(const line of saved.lines)Object.assign(line,{packageId:null,packageName:null,packageGroupKey:null});
 const f=fixture({tickets:[saved],eligibility:'ineligible',change:{kind:'packages',before,after:{...before,minimumWeightLbs:20,basePriceCents:1900}}}),original=clone(f.records.get('ticket')),result=await f.run();
 assert.equal(result.updated,0);assert.match(result.review[0].reason,/eligibility/);assert.equal(f.writes.length,0);assert.deepEqual(f.records.get('ticket'),original);
});
