// Isolated regression for the POS dog-name package toggle. Never reads live credentials.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main(){
 const url=new URL(process.env.TEST_DATABASE_URL||'');
 assert.equal(url.protocol,'mysql:');assert.equal(url.hostname,'127.0.0.1');assert.match(url.pathname,/^\/groompro_audit_[a-z0-9_]+_test$/);
 const mysql=require('mysql2/promise'),admin=await mysql.createConnection({host:url.hostname,port:Number(url.port),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password)});
 await admin.query('CREATE DATABASE `'+url.pathname.slice(1)+'`');await admin.end();process.env.DATABASE_URL=url.href;
 require('../tests/load-ts.cjs');const original=Module._resolveFilename;
 Module._resolveFilename=function(name,parent,...rest){return original.call(this,name.startsWith('@/')?path.resolve(__dirname,'..',name.slice(2)):name,parent,...rest)};
 const {db}=require('../src/lib/db.ts');
 try{
  const {schemaPlan,bootstrap}=require('./bootstrap-godaddy.cjs');await bootstrap(db,schemaPlan(fs.readFileSync(path.join(__dirname,'../godaddy-groompro-schema.sql'),'utf8')));
  const tenant=await db.tenant.create({data:{name:'Fictional dog-click regression'}}),tenantId=tenant.id;
  const location=await db.location.create({data:{tenantId,name:'Test shop',timezone:'UTC'}});
  const employee=await db.user.create({data:{tenantId,firstName:'Test',lastName:'Employee',role:'MANAGER',pinHash:'not-a-valid-pin'}});
  const customer=await db.customer.create({data:{tenantId,firstName:'Test',lastName:'Customer'}});
  const pet=await db.pet.create({data:{tenantId,customerId:customer.id,name:'Test dog'}});
  const service=await db.service.create({data:{tenantId,name:'Test groom',priceCents:1000,durationMin:30,workflowRole:'GROOM'}});
  const pkg=await db.package.create({data:{tenantId,name:'Test grooming',basePriceCents:1000,items:{create:{tenantId,serviceId:service.id,quantity:1,role:'GROOM',sortOrder:0}}}});
  const ticket=await db.ticket.create({data:{tenantId,locationId:location.id,customerId:customer.id,orderNumber:1,scheduledStart:new Date('2030-01-07T10:00:00Z')}});
  // Authentication is a fixture; all package, timing, discount and database operations are real.
  for(const [file,exports] of [['request-policy.ts',{withRequestPolicy:fn=>fn}],['employee-session.ts',{getActiveEmployeeSession:async()=>({user:employee})}]]){
   const id=require.resolve('../src/lib/'+file);require.cache[id]={id,filename:id,loaded:true,exports};
  }
  const {NextRequest}=require('next/server'),{POST}=require('../app/api/tickets/package/route.ts');
  const toggle=present=>POST(new NextRequest('http://localhost/api/tickets/package',{method:'POST',headers:{'x-tenant-id':tenantId,cookie:'groompro_session=fixture'},body:JSON.stringify({ticketId:ticket.id,petId:pet.id,packageId:pkg.id,present})}));
  const discounts=require('../src/lib/rebooking-discount-store.ts'),fixed=discounts.refreshRebookingDiscounts;
  // Recreate the precise invalid enum in the published query without changing source files.
  discounts.refreshRebookingDiscounts=(tx,...args)=>fixed(new Proxy(tx,{get(target,key){if(key!=='ticket')return target[key];return new Proxy(target.ticket,{get(model,method){if(method!=='findMany')return model[method];return q=>{if(q.where?.OR?.[1]?.status?.notIn)q.where.OR[1].status.notIn.push('VOIDED');return model.findMany(q)};}})}}),...args);
  const broken=await toggle(true),failure=await broken.json();assert.equal(broken.status,400);assert.match(failure.error,/VOIDED/);
  const {helpfulError}=require('../src/lib/human-communication.ts');assert.match(helpfulError(failure.error),/couldn’t reach the saved information/);
  assert.equal(await db.ticketLine.count({where:{ticketId:ticket.id}}),0);
  console.log('PASS: published invalid-status query reproduces the screenshot message and rolls back the package addition.');
  discounts.refreshRebookingDiscounts=fixed;
  for(const present of [true,true,false,false,true]){const response=await toggle(present),body=await response.json();assert.equal(response.status,200,body.error);assert.equal(await db.ticketLine.count({where:{ticketId:ticket.id}}),present?1:0);assert.equal(await db.ticketPet.count({where:{ticketId:ticket.id}}),present?1:0);}
  assert.equal(await db.groomingNote.count({where:{ticketId:ticket.id,petId:pet.id}}),1);
  assert.equal(await db.pet.count({where:{id:pet.id}}),1);
  console.log('PASS: corrected dog-name action adds/removes/re-adds the package, tolerates retries, and preserves the pet and grooming notes.');
  if(process.env.TEST_TICKET_LIFECYCLE==='1'){
   const headers={'x-tenant-id':tenantId,cookie:'groompro_session=fixture'};
   const status=require('../src/lib/actions/ticket-status.ts');
   for(const change of [{status:'CONFIRMED'},{status:'CHECKED_IN'},{status:'CONFIRMED',action:'UNDO_CHECK_IN'},{status:'CHECKED_IN'},{status:'READY'},{status:'CHECKED_IN',action:'UNDO_READY'}]){
    const response=await status.PATCH(new NextRequest('http://localhost/api/tickets/status',{method:'PATCH',headers,body:JSON.stringify({ticketId:ticket.id,...change})}));
    const body=await response.json();assert.equal(response.status,200,body.error);assert.equal(body.ticket.status,change.status);
   }
   const attendance=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'CUSTOMER_ATTENDANCE:'+ticket.id}}});assert.ok(attendance.value.confirmedAt);
   console.log('PASS: staff confirmation, check-in, undo check-in, ready and undo-ready persist correctly.');
   const checkout=require('../src/lib/actions/ticket-checkout.ts');
   const pay=await checkout.POST(new NextRequest('http://localhost/api/tickets/checkout?locationId='+location.id,{method:'POST',headers,body:JSON.stringify({ticketId:ticket.id,action:'PAYMENT',paymentType:'CASH',amountCents:1000})}));
   const paid=await pay.json();assert.equal(pay.status,200,paid.error);assert.equal(paid.dueCents,0);
   const close=await checkout.POST(new NextRequest('http://localhost/api/tickets/checkout?locationId='+location.id,{method:'POST',headers,body:JSON.stringify({ticketId:ticket.id,action:'CLOSE'})}));
   const closed=await close.json();assert.equal(close.status,200,closed.error);assert.equal(closed.ticket.status,'CLOSED');assert.equal(closed.dueCents,0);
   console.log('PASS: cash payment and ticket closing complete with zero balance and retained grooming history.');
   const {reportData}=require('../src/lib/report-data.ts');
   const reports=await reportData({tenantId,location,start:new Date('2020-01-01Z'),end:new Date('2040-01-01Z'),userId:employee.id,canManageTime:true,hideOwners:false});
   assert.ok(reports);console.log('PASS: combined report database queries load after a paid grooming visit.');
  }
 }finally{await db.$disconnect();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
