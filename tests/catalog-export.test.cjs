const test=require('node:test'),assert=require('node:assert/strict');require('./load-ts.cjs');
const {prepareCatalogDatasets}=require('../src/lib/import/catalog-proposals.ts');
const {portableValue,tenantExport}=require('../src/lib/tenant-export.ts');
const {Prisma}=require('@prisma/client');
const appointment=lines=>({name:'Visits',entity:'APPOINTMENT',headers:['Lines'],mapping:{Lines:'Lines'},idColumn:'ID',rows:[{ID:'visit',Lines:lines}]});
test('catalog proposals retain source service/package IDs and do not change booked lines',()=>{
 const lines=[{serviceId:'s',description:'Bath',unitPriceCents:2000,durationMin:20,packageId:'p',packageName:'Wash',petId:'dog',quantity:1,role:'BATH'}];
 const before=JSON.stringify(lines),data=prepareCatalogDatasets([appointment(lines)]);
 assert.equal(JSON.stringify(lines),before);assert.deepEqual(require('../src/lib/import/engine.ts').validateDatasets(data),[]);assert.equal(data[0].rows[0].ID,'s');assert.equal(data[1].rows[0].PackageID,'p');assert.equal(JSON.parse(data[1].rows[0].Items)[0].serviceId,'s');
});
test('two dogs using the same package do not duplicate its catalog contents',()=>{
 const line={serviceId:'s',description:'Bath',unitPriceCents:2000,durationMin:20,packageId:'p',packageName:'Wash',quantity:1,role:'BATH'};
 const data=prepareCatalogDatasets([appointment([{...line,petId:'one'},{...line,petId:'two'}])]);assert.equal(JSON.parse(data[1].rows[0].Items).length,1);assert.equal(data[1].rows[0].Price,'20.00');
});
test('catalog proposals reject conflicting prices and do not invent IDs for descriptions',()=>{
 assert.throws(()=>prepareCatalogDatasets([appointment([{serviceId:'s',description:'Bath',unitPriceCents:2000},{serviceId:'s',description:'Bath',unitPriceCents:3000}])]),/different/);
 assert.deepEqual(prepareCatalogDatasets([appointment([{description:'Bath',unitPriceCents:2000}])]),[]);
});
test('portable records redact credentials recursively and retain ordinary linked data',()=>{
 const result=portableValue({id:'c',petId:'p',notes:'Keep tail long',secret:true,password:'secret',nested:{pin:'1234',providerPaymentMethodId:'token',amountCents:123},date:new Date('2026-01-01Z')});
 assert.deepEqual(result,{id:'c',petId:'p',notes:'Keep tail long',secret:true,nested:{amountCents:123},date:'2026-01-01T00:00:00.000Z'});
});
test('portable export scopes child-only tables through their tenant-owned parent',async()=>{
 const queries=[];const tx={tenant:{findMany:async()=>[{id:'tenant'}]},tenantSetting:{findMany:async()=>[]},importRecord:{findMany:async()=>[]},$queryRaw:async(strings,name)=>['BookingAssetSchedule','PricingChangeItem'].includes(name)?[{name:'id'}]:[],$queryRawUnsafe:async(sql,tenant)=>{queries.push([sql,tenant]);return[{id:'child'}]}};
 for(const m of Prisma.dmmf.datamodel.models){const key=m.name[0].toLowerCase()+m.name.slice(1);tx[key]??={findMany:async args=>{assert.ok(args.where.tenantId||args.where.ticket?.tenantId||args.where.package?.tenantId);return[]}};}
 const exported=await tenantExport(tx,'tenant');assert.equal(exported.tables.BookingAssetSchedule[0].id,'child');assert.ok(queries.every(([sql,tenant])=>sql.includes('parent.tenantId = ?')&&tenant==='tenant'));assert.equal(exported.warnings.length,0);
});
test('reviewed catalog proposals produce linked usable packages for future bookings',async()=>{
 const {planImport}=require('../src/lib/import/engine.ts');
 const client=Object.fromEntries(['customer','pet','user','service','package','ticket','importRecord'].map(k=>[k,{findMany:async()=>[]}]));client.tenantSetting={findUnique:async()=>null};
 const datasets=prepareCatalogDatasets([appointment([{serviceId:'s',description:'Bath',unitPriceCents:2000,durationMin:20,packageId:'p',packageName:'Wash',petId:'dog',quantity:1,role:'BATH'}])]);
 const plan=await planImport(client,'tenant','source',datasets,'NEW');assert.deepEqual(plan.issues,[]);
 const service=plan.plans.find(p=>p.entity==='SERVICE'),pkg=plan.plans.find(p=>p.entity==='PACKAGE');
 assert.equal(service.data.workflowRole,'BATH');assert.equal(service.data.durationMin,20);assert.equal(pkg.data.basePriceCents,2000);assert.equal(pkg.data.items.create[0].serviceId,service.targetId);
});
