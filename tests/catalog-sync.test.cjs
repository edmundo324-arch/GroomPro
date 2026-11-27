require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {catalogSyncScope,catalogSyncTicketAllowed,planCatalogTicketUpdate}=require('../src/lib/catalog-sync.ts');
const {allocatePackage}=require('../src/lib/package-lines.ts');

const now=new Date('2026-11-26T23:30:00Z');
const service=(id='prep',patch={})=>({id,name:id==='prep'?'Prepared Before Bath':'Full Wash',description:'Comfortable care.',priceCents:1500,durationMin:20,workflowRole:id==='prep'?'PREP':'BATH',active:true,commissionPct:10,...patch});
const line=(item=service(),patch={})=>({id:'line-'+item.id,lineType:'SERVICE',serviceId:item.id,productId:null,petId:'dog',description:item.name,reportCardDescription:item.description,packageId:null,packageName:null,packageGroupKey:null,sourceKey:null,quantity:1,role:item.workflowRole,unitPriceCents:item.priceCents,discountCents:0,totalCents:item.priceCents,durationMin:item.durationMin,commissionPct:10,commissionCents:Math.round(item.priceCents/10),assignedUserId:'worker',assignedAt:'2026-11-26T15:00:00Z',sortOrder:0,...patch});
const ticket=(patch={})=>({id:'ticket',tenantId:'business',locationId:'shop',location:{timezone:'America/Chicago'},status:'OPEN',scheduledStart:'2026-11-27T01:00:00Z',payments:[],accountCreditCents:0,lines:[line()],...patch});
function packageFixture({basePriceCents=10000,locationPricing=[],multiplier=1}={}){
 const services=[service(),service('bath')],before={id:'package',name:'Full-Wash 19',basePriceCents,items:[{serviceId:'prep',quantity:1,role:'PREP'},{serviceId:'bath',quantity:2,role:'BATH'}]};
 const rule=locationPricing.find(r=>r.locationId==='shop'&&r.active!==false),price=rule?.priceOverrideCents??Math.round(basePriceCents*(1+Number(rule?.priceAdjustmentPct||0)/100));
 const allocated=allocatePackage(price*multiplier,before.items.map(i=>i.quantity*multiplier));
 const lines=before.items.map((item,index)=>line(services[index],{...allocated[index],packageId:before.id,packageName:before.name,packageGroupKey:'dog:'+before.id,description:before.name+' · '+services[index].name,assignedUserId:index===0?'prepper':'bather',sortOrder:index,commissionCents:Math.round(allocated[index].totalCents/10)}));
 return {before,services,locationPricing,ticket:ticket({lines}),change(after){return {kind:'packages',before,after:{...before,...after},services,locationPricing}}};
}

test('sync choices validate explicit values and older callers default to new bookings only',()=>{
 assert.equal(catalogSyncScope(undefined),'NONE');
 for(const scope of ['ALL','FUTURE','NONE'])assert.equal(catalogSyncScope(scope),scope);
 for(const scope of ['',null,'TODAY','CLOSED','everything',false,['ALL'],{scope:'ALL'}])assert.throws(()=>catalogSyncScope(scope),/Choose where/);
});

test('scope uses each shop calendar day and keeps future checked-in work out of future-only sync',()=>{
 const today=ticket(),tomorrow=ticket({scheduledStart:'2026-11-27T10:00:00Z'}),yesterday=ticket({scheduledStart:'2026-11-25T20:00:00Z'}),unscheduled=ticket({scheduledStart:null});
 for(const candidate of [today,tomorrow,unscheduled])assert.equal(catalogSyncTicketAllowed(candidate,'ALL',now),true);
 for(const candidate of [today,tomorrow,yesterday,unscheduled])assert.equal(catalogSyncTicketAllowed(candidate,'NONE',now),false);
 assert.equal(catalogSyncTicketAllowed(today,'FUTURE',now),false);
 assert.equal(catalogSyncTicketAllowed(tomorrow,'FUTURE',now),true);
 assert.equal(catalogSyncTicketAllowed(yesterday,'ALL',now),false);assert.equal(catalogSyncTicketAllowed(yesterday,'FUTURE',now),false);
 assert.equal(catalogSyncTicketAllowed(unscheduled,'FUTURE',now),false);
 assert.equal(catalogSyncTicketAllowed({...tomorrow,checkedInAt:now},'FUTURE',now),false);
 const tokyo={...tomorrow,location:{timezone:'Asia/Tokyo'}};
 assert.equal(catalogSyncTicketAllowed(tokyo,'ALL',now),true);assert.equal(catalogSyncTicketAllowed(tokyo,'FUTURE',now),false);
});

test('terminal, closed-date, paid, credited and fee-processed tickets never qualify',()=>{
 const protectedChanges=[...['CLOSED','CANCELLED','NO_SHOW','VOID','VOIDED'].map(status=>({status})),{closedAt:now},{displayStatus:'Voided'},{payments:[{amount:'1.00'}]},{payments:[{amount:'0.00'}]},{accountCreditCents:1},{noShowFeeProcessedAt:now}];
 for(const patch of protectedChanges)for(const scope of ['ALL','FUTURE','NONE'])assert.equal(catalogSyncTicketAllowed(ticket({...patch,scheduledStart:'2026-11-27T10:00:00Z'}),scope,now),false,JSON.stringify({patch,scope}));
});

test('ordinary service changes update snapshots and net commission without changing work assignments',()=>{
 const before=service(),original=line(before,{quantity:2,discountCents:200,totalCents:2800,commissionCents:280}),originalTicket=ticket({lines:[original]}),snapshot=JSON.stringify(originalTicket);
 const result=planCatalogTicketUpdate(originalTicket,{kind:'services',before,after:{...before,name:'Gentle Prep',description:'A calm start.',priceCents:2000,durationMin:30}}),updated=result.lines[0];
 assert.equal(result.changed,true);assert.equal(updated.description,'Gentle Prep');assert.equal(updated.reportCardDescription,'A calm start.');assert.equal(updated.durationMin,30);
 assert.equal(updated.unitPriceCents,2000);assert.equal(updated.discountCents,200);assert.equal(updated.totalCents,3800);assert.equal(updated.commissionCents,380);
 for(const field of ['id','petId','quantity','role','assignedUserId','assignedAt','sortOrder'])assert.equal(updated[field],original[field],field);
 assert.equal(JSON.stringify(originalTicket),snapshot,'Planner must not mutate saved records');
});

test('staff-entered wording, price and duration survive service updates',()=>{
 const before=service(),original=line(before,{description:'Handle gently',reportCardDescription:'Custom care note',unitPriceCents:1200,totalCents:1200,durationMin:35});
 const result=planCatalogTicketUpdate(ticket({lines:[original]}),{kind:'services',before,after:{...before,name:'New name',description:'New default note',priceCents:2500,durationMin:45,workflowRole:'DRY'}});
 assert.deepEqual(result.lines[0],original);assert.equal(result.changed,false);assert.ok(result.notes.some(n=>/price/.test(n)));assert.ok(result.notes.some(n=>/duration/.test(n)));assert.ok(result.notes.some(n=>/role/.test(n)));
});

test('service price respects fixed and percent location rules and does not reprice packaged services',()=>{
 const before=service(),after={...before,priceCents:2500};
 const fixed=[{locationId:'other',priceOverrideCents:1},{locationId:'shop',priceOverrideCents:1700,active:true}];
 const fixedResult=planCatalogTicketUpdate(ticket({lines:[line(before,{unitPriceCents:1700,totalCents:1700,commissionCents:170})]}),{kind:'services',before,after,locationPricing:fixed});
 assert.equal(fixedResult.changed,false);assert.equal(fixedResult.lines[0].unitPriceCents,1700);
 const percent=[{locationId:'shop',priceAdjustmentPct:10,active:true}];
 const percentResult=planCatalogTicketUpdate(ticket({lines:[line(before,{unitPriceCents:1650,totalCents:1650,commissionCents:165})]}),{kind:'services',before,after,locationPricing:percent});
 assert.equal(percentResult.lines[0].unitPriceCents,2750);
 const packaged=line(before,{packageId:'pkg',packageName:'Bath Bundle',description:'Bath Bundle · '+before.name,unitPriceCents:300,totalCents:300});
 const result=planCatalogTicketUpdate(ticket({lines:[packaged]}),{kind:'services',before,after:{...after,name:'New Prep',durationMin:25}});
 assert.equal(result.lines[0].unitPriceCents,300);assert.equal(result.lines[0].totalCents,300);assert.equal(result.lines[0].description,'Bath Bundle · New Prep');assert.equal(result.lines[0].durationMin,25);
});

test('special terms and unrelated extra lines remain unchanged, but ordinary offers can update',()=>{
 const before=service(),protectedLine=line(before,{sourceKey:'PREPAID_REDEEM:owned-package'}),extra=line(service('other'),{id:'extra'}),offer=line(before,{id:'offer',sourceKey:'offer-today:prep'});
 const result=planCatalogTicketUpdate(ticket({lines:[protectedLine,extra,offer]}),{kind:'services',before,after:{...before,priceCents:2500,durationMin:30}});
 assert.deepEqual(result.lines[0],protectedLine);assert.deepEqual(result.lines[1],extra);assert.equal(result.lines[2].unitPriceCents,2500);assert.ok(result.notes.some(n=>/special/.test(n)));
});

test('package prices redistribute exact cents, keep employee IDs and extra discounts, and respect location overrides',()=>{
 const f=packageFixture(),original=f.ticket.lines.map(l=>({...l}));
 f.ticket.lines[0].discountCents+=73;f.ticket.lines[0].totalCents-=73;
 const result=planCatalogTicketUpdate(f.ticket,f.change({basePriceCents:10001}));
 assert.equal(result.lines.reduce((sum,l)=>sum+l.totalCents,0),10001-73);
 for(const [index,l] of result.lines.entries()){assert.equal(l.id,original[index].id);assert.equal(l.assignedUserId,original[index].assignedUserId);assert.equal(l.assignedAt,original[index].assignedAt);assert.equal(l.totalCents,l.quantity*l.unitPriceCents-l.discountCents)}
 const fixed=packageFixture({locationPricing:[{locationId:'shop',priceOverrideCents:9001,active:true}]});
 const fixedResult=planCatalogTicketUpdate(fixed.ticket,fixed.change({basePriceCents:13000}));
 assert.equal(fixedResult.lines.reduce((sum,l)=>sum+l.totalCents,0),9001);assert.equal(fixedResult.changed,false);
 const multiple=packageFixture({multiplier:2});assert.equal(planCatalogTicketUpdate(multiple.ticket,multiple.change({basePriceCents:10001})).lines.reduce((sum,l)=>sum+l.totalCents,0),20002);
});

test('adding package content retains existing lines, custom durations and workers, and leaves extras untouched',()=>{
 const f=packageFixture(),dry=service('dry',{name:'Drying',workflowRole:'DRY',durationMin:15});f.services.push(dry);f.ticket.lines[0].durationMin=47;
 const extra=line(service('extra'),{id:'extra',description:'Nail Color',sortOrder:2});f.ticket.lines.push(extra);
 const result=planCatalogTicketUpdate(f.ticket,f.change({name:'Complete Full Wash',items:[...f.before.items,{serviceId:'dry',quantity:1,role:'DRY'}]}));
 assert.equal(result.lines.length,4);assert.equal(result.lines.find(l=>l.id==='line-prep').durationMin,47);assert.equal(result.lines.find(l=>l.id==='line-bath').assignedUserId,'bather');
 const added=result.lines.find(l=>l.serviceId==='dry');assert.equal(added.id,undefined);assert.equal(added.assignedUserId,null);assert.equal(added.durationMin,15);assert.equal(added.description,'Complete Full Wash · Drying');assert.equal(added.role,'DRY');
 assert.equal(result.lines.filter(l=>l.packageId==='package').reduce((n,l)=>n+l.totalCents,0),10000);
 assert.deepEqual({...result.lines.find(l=>l.id==='extra'),sortOrder:extra.sortOrder},extra);
 assert.equal(result.lines[3].sortOrder,3);
});

test('unassigned undiscounted package service may be removed while remaining service identity is preserved',()=>{
 const f=packageFixture();f.ticket.lines[1].assignedUserId=null;
 const result=planCatalogTicketUpdate(f.ticket,f.change({items:[f.before.items[0]]}));
 assert.equal(result.lines.length,1);assert.equal(result.lines[0].id,'line-prep');assert.equal(result.lines[0].assignedUserId,'prepper');assert.equal(result.lines[0].totalCents,10000);
});

test('reordering included services persists the selected order and preserves employee and line identities',()=>{
 const f=packageFixture(),result=planCatalogTicketUpdate(f.ticket,f.change({items:[...f.before.items].reverse()}));
 assert.equal(result.changed,true);assert.deepEqual(result.lines.map(l=>l.id),['line-bath','line-prep']);assert.deepEqual(result.lines.map(l=>l.sortOrder),[0,1]);
 for(const original of f.ticket.lines){const updated=result.lines.find(l=>l.id===original.id);assert.equal(updated.assignedUserId,original.assignedUserId);assert.equal(updated.assignedAt,original.assignedAt)}
});

test('the same package on two dogs updates each group without mixing staff or pet identities',()=>{
 const f=packageFixture(),second=f.ticket.lines.map(l=>({...l,id:l.id+'-second',petId:'second-dog',packageGroupKey:'second-dog:package',assignedUserId:'second-'+l.assignedUserId,sortOrder:l.sortOrder+2}));
 f.ticket.lines.push(...second);
 const result=planCatalogTicketUpdate(f.ticket,f.change({basePriceCents:11003}));
 for(const petId of ['dog','second-dog'])assert.equal(result.lines.filter(l=>l.petId===petId).reduce((sum,l)=>sum+l.totalCents,0),11003);
 for(const original of f.ticket.lines){const saved=result.lines.find(l=>l.id===original.id);assert.equal(saved.petId,original.petId);assert.equal(saved.assignedUserId,original.assignedUserId);assert.equal(saved.packageGroupKey,original.packageGroupKey)}
});

test('custom package prices, missing content, changed quantities and assigned removals require review',()=>{
 for(const mutate of [
  f=>{f.ticket.lines[0].unitPriceCents++;f.ticket.lines[0].totalCents++},
  f=>f.ticket.lines.pop(),
  f=>{f.ticket.lines[0].quantity=2;f.ticket.lines[0].totalCents=f.ticket.lines[0].unitPriceCents*2},
  f=>{f.ticket.lines[0].sourceKey='PREPAID_REDEEM:x'}
 ]){const f=packageFixture();mutate(f);assert.throws(()=>planCatalogTicketUpdate(f.ticket,f.change({basePriceCents:12000})),/Review|review/)}
 const f=packageFixture();assert.throws(()=>planCatalogTicketUpdate(f.ticket,f.change({items:[f.before.items[0]]})),/assigned work/);
 const role=packageFixture();assert.throws(()=>planCatalogTicketUpdate(role.ticket,role.change({items:[{...role.before.items[0],role:'DRY'},role.before.items[1]]})),/assigned employee/);
});

test('price changes cannot erase discounts or replace individually saved totals',()=>{
 const before=service();
 assert.throws(()=>planCatalogTicketUpdate(ticket({lines:[line(before,{discountCents:1400,totalCents:100})]}),{kind:'services',before,after:{...before,priceCents:1000}}),/discount needs review/);
 assert.throws(()=>planCatalogTicketUpdate(ticket({lines:[line(before,{totalCents:999})]}),{kind:'services',before,after:{...before,name:'Different'}}),/individually saved total/);
});

test('legacy package identities use the before catalog and never acquire a service retail price',()=>{
 const f=packageFixture({basePriceCents:4500});
 const packages=[{...f.before,items:f.before.items.map(item=>({...item,service:f.services.find(s=>s.id===item.serviceId)}))}];
 const legacy={...f.ticket,lines:f.ticket.lines.map(l=>({...l,packageId:null,packageName:null,packageGroupKey:null}))};
 const unchanged=JSON.stringify(legacy),before=f.services[0];
 const result=planCatalogTicketUpdate(legacy,{kind:'services',before,after:{...before,name:'Gentle Prep',priceCents:3000},packages});
 assert.equal(result.changed,true);assert.equal(result.lines[0].unitPriceCents,1500);assert.equal(result.lines.reduce((n,l)=>n+l.totalCents,0),4500);
 assert.equal(result.lines[0].packageId,'package');assert.equal(result.lines[0].packageGroupKey,'dog:package');assert.equal(result.lines[0].description,'Full-Wash 19 · Gentle Prep');
 assert.equal(JSON.stringify(legacy),unchanged);
 const renamed=planCatalogTicketUpdate(legacy,{...f.change({name:'Complete Full Wash',basePriceCents:6000}),packages});
 assert.equal(renamed.lines.reduce((n,l)=>n+l.totalCents,0),6000);assert.ok(renamed.lines.every(l=>l.packageId==='package'&&l.packageName==='Complete Full Wash'));
});

test('missing or ambiguous legacy identities require review instead of guessed package pricing',()=>{
 const f=packageFixture({basePriceCents:4500}),legacy={...f.ticket,lines:f.ticket.lines.map(l=>({...l,packageId:null,packageName:null,packageGroupKey:null}))};
 const pkg={...f.before,items:f.before.items.map(item=>({...item,service:f.services.find(s=>s.id===item.serviceId)}))};
 const before=f.services[0],change={kind:'services',before,after:{...before,priceCents:3000}};
 for(const packages of [[],[pkg,{...pkg,id:'another-package'}]]){
  assert.throws(()=>planCatalogTicketUpdate(legacy,{...change,packages}),/older package could not be matched safely/);
  assert.throws(()=>planCatalogTicketUpdate(legacy,{...f.change({basePriceCents:6000}),packages}),/older package could not be matched safely/);
 }
 const special={...legacy,lines:[{...legacy.lines[0],sourceKey:'PREPAID_REDEEM:visit'}]};
 assert.deepEqual(planCatalogTicketUpdate(special,{...change,packages:[pkg]}).lines,special.lines);
});
