// Local, isolated fixtures. Never runs against a hosted database.
require('../tests/load-ts.cjs');
const assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path');
const originalResolve=Module._resolveFilename;Module._resolveFilename=function(name,...rest){return originalResolve.call(this,name.startsWith('@/')?path.join(process.cwd(),name.slice(2)):name,...rest)};
if(!/^mysql:\/\/[^@]+@127\.0\.0\.1:33316\//.test(process.env.DATABASE_URL||''))throw Error('Local test database required.');
if(!process.env.GROOMPRO_TEST_PIN)throw Error('GROOMPRO_TEST_PIN is required.');
const {NextRequest}=require('next/server'),{db}=require('../src/lib/db.ts');
const tenantId='cmv3kbyv20000v5kwb1vazvit',otherTenant='breed-test-other';
const pets=require('../app/api/pets/route.ts'),catalog=require('../app/api/catalog/route.ts'),breeds=require('../app/api/breeds/route.ts'),pin=require('../app/api/employee/session/route.ts');
const {resolveSaleLines}=require('../src/lib/pos-lines.ts');
let cookie='',owner,pet,service,pack,plan;
const request=(body,method='POST',tenant=tenantId)=>new NextRequest('http://localhost/api/test',{method,headers:{'x-tenant-id':tenant,'Content-Type':'application/json',cookie},...(method!=='GET'?{body:JSON.stringify(body)}:{})});
const routes=new Map([[pets.POST,'/api/pets'],[pets.PATCH,'/api/pets'],[catalog.POST,'/api/catalog'],[breeds.POST,'/api/breeds']]);
async function call(url,body,method='POST',tenant=tenantId){return fetch('http://127.0.0.1:33318'+url,{method,headers:{'x-tenant-id':tenant,'Content-Type':'application/json',cookie},body:JSON.stringify(body)});}
async function ok(handler,body,method='POST'){const r=await call(routes.get(handler),body,method),d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d;}
(async()=>{try{
 const auth=await call('/api/employee/session',{pin:process.env.GROOMPRO_TEST_PIN});assert.equal(auth.status,200);cookie=auth.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
 owner=await db.customer.create({data:{tenantId,firstName:'Breed QA',lastName:'Temporary'}});
 service=await db.service.create({data:{tenantId,name:'Breed QA service',priceCents:5000,durationMin:30}});
 pet=(await ok(pets.POST,{customerId:owner.id,name:'Breed QA dog',breed:'Yorkie',weightLbs:12,coatLength:'Long',coatTexture:'Straight'})).pet;
 assert.equal(pet.breedId,'breed-yorkshire-terrier');assert.equal(pet.breed,'Yorkie');assert.equal(pet.originalBreed,'Yorkie');assert.equal(pet.customerId,owner.id);
 const common={name:'Breed QA offer',priceCents:5000,active:true,minimumWeightLbs:0,maximumWeightLbs:14,groomingRules:{coatLengths:['Long']},items:[{serviceId:service.id,quantity:1,role:'GROOM'}]};
 pack=(await ok(catalog.POST,{...common,kind:'packages'})).item;
 plan=(await ok(catalog.POST,{...common,kind:'plans',billingDay:1})).item;
 assert.equal(plan.maximumWeightLbs,14);assert.equal(pack.groomingRules.coatLengths[0],'Long');
 const line=await resolveSaleLines(db,tenantId,[{type:'PACKAGE',id:pack.id,petId:pet.id}],[pet.id]);assert.equal(line.lines[0].totalCents,5000);
 const {breed:omittedBreed,...partialPet}=pet;
 const updated=await ok(pets.PATCH,{...partialPet,customerId:owner.id,weightLbs:20},'PATCH');assert.equal(updated.pet.breed,'Yorkie');assert.equal(updated.pet.breedId,pet.breedId);
 await assert.rejects(resolveSaleLines(db,tenantId,[{type:'PACKAGE',id:pack.id,petId:pet.id}],[pet.id]),/weight/);
 const rejectedVip=await call('/api/memberships',{customerId:owner.id,petId:pet.id,planId:plan.id,billingDay:1});assert.equal(rejectedVip.status,400);assert.match((await rejectedVip.json()).error,/weight/);
 const memberships=await db.$queryRaw`SELECT id FROM Membership WHERE tenantId=${tenantId} AND petId=${pet.id}`;assert.equal(memberships.length,0);
 const foreign=await call('/api/pets',{...pet,customerId:owner.id},'PATCH',otherTenant);assert.equal(foreign.status,401);
 const unknown=await ok(pets.PATCH,{...pet,breed:'Unlisted QA mix',breedId:null,primaryBreedId:null,secondaryBreedId:null},'PATCH');assert.equal(unknown.pet.breedId,null);assert.equal(unknown.pet.originalBreed,'Yorkie');
 const review=await ok(breeds.POST,{action:'RECONCILE'});assert.ok(review.review.some(p=>p.id===pet.id));
 console.log(JSON.stringify({passed:true,checks:['PIN authorization','pet owner retained','alias ID and original text','package/VIP shared rule persistence','actual-weight eligibility enforced server-side','VIP rejection without enrollment','foreign tenant rejected','unknown breed review'],linkedExistingPets:review.linked,reviewCount:review.review.length}));
 }finally{
 if(plan)await db.tenantSetting.deleteMany({where:{tenantId,settingKey:'VIP_PLAN:'+plan.id}});
 if(pack){await db.packageItem.deleteMany({where:{tenantId,packageId:pack.id}});await db.package.deleteMany({where:{tenantId,id:pack.id}});}
 if(pet)await db.pet.deleteMany({where:{tenantId,id:pet.id}});
 if(owner)await db.customer.deleteMany({where:{tenantId,id:owner.id}});
 if(service)await db.service.deleteMany({where:{tenantId,id:service.id}});
 await db.$disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1});
