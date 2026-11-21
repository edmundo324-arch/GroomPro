// Real database checks. Refuses non-loopback targets and creates a fresh *_test database.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {randomUUID}=require('node:crypto');
async function main(){
 const url=new URL(process.env.TEST_DATABASE_URL||'');assert.equal(url.protocol,'mysql:');assert.equal(url.hostname,'127.0.0.1');assert.match(url.pathname,/^\/groompro_audit_[a-z0-9_]+_test$/);
 const mysql=require('mysql2/promise');const admin=await mysql.createConnection({host:url.hostname,port:Number(url.port),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password)});
 await admin.query('CREATE DATABASE `'+url.pathname.slice(1)+'`');await admin.end();
 process.env.DATABASE_URL=url.href;
 require('../tests/load-ts.cjs');
 const original=Module._resolveFilename;Module._resolveFilename=function(name,parent,...rest){return original.call(this,name.startsWith('@/')?path.resolve(__dirname,'..',name.slice(2)):name,parent,...rest)};
 const {db}=require('../src/lib/db.ts');
 try{
 const {schemaPlan,bootstrap,verify}=require('./bootstrap-godaddy.cjs');const plan=schemaPlan(fs.readFileSync(path.join(__dirname,'../godaddy-groompro-schema.sql'),'utf8'));
 await bootstrap(db,plan);await verify(db,plan);
 const tenant=await db.tenant.create({data:{name:'Isolated booking test'}}),tenantId=tenant.id;
 const location=await db.location.create({data:{tenantId,name:'Fictional Shop',timezone:'UTC'}}),locationId=location.id;
 const service=await db.service.create({data:{tenantId,name:'Test groom',priceCents:5000,durationMin:60,workflowRole:'GROOM'}});
 const {defaultPortalPolicy}=require('../src/lib/cancellation-policy.ts');
 await db.tenantSetting.create({data:{tenantId,settingKey:'CUSTOMER_PORTAL_POLICY',value:{...defaultPortalPolicy,approval:'AUTOMATIC',bookableItems:['SERVICE:'+service.id]}}});
 const asset='asset-'+randomUUID();await db.$executeRaw`INSERT INTO BookingAsset (id,tenantId,locationId,name,category) VALUES (${asset},${tenantId},${locationId},'Test station','GROOMING')`;
 for(let day=0;day<7;day++)await db.$executeRaw`INSERT INTO BookingAssetSchedule (id,assetId,dayOfWeek,startTime,endTime) VALUES (${randomUUID()},${asset},${day},'08:00','18:00')`;
 let start=new Date();start.setUTCDate(start.getUTCDate()+7);start.setUTCHours(10,0,0,0);if(start.getUTCDay()===0)start.setUTCDate(start.getUTCDate()+1);
 const customers=[];for(let i=0;i<2;i++){const c=await db.customer.create({data:{tenantId,firstName:'Fictional',lastName:'Customer '+i}});const pet=await db.pet.create({data:{tenantId,customerId:c.id,name:'Test dog '+i}});customers.push({c,pet});}
 const {createTicket}=require('../src/lib/actions/ticket-booking.ts'),{NextRequest}=require('next/server');
 async function book(pair,requestId){const body={customerId:pair.c.id,petIds:[pair.pet.id],lines:[{type:'SERVICE',id:service.id,petId:pair.pet.id}],scheduledStart:start.toISOString(),bookingSource:'ONLINE'};return createTicket(new NextRequest('http://localhost/api/tickets',{method:'POST',body:JSON.stringify(body)}),{tenantId,locationId,customerId:pair.c.id,selections:[{petId:pair.pet.id,itemKey:'SERVICE:'+service.id}],resourceKey:'asset:'+asset,requestId,durationMin:60,subtotalCents:5000});}
 const ids=customers.map(()=>randomUUID());const results=await Promise.allSettled(customers.map((c,i)=>book(c,ids[i])));
 const successes=results.filter(r=>r.status==='fulfilled'&&r.value.ok);assert.equal(successes.length,1,JSON.stringify(results.map(r=>r.status==='rejected'?String(r.reason):r.value.status)));
 assert.equal(await db.ticket.count(),1);
 const winner=results.findIndex(r=>r.status==='fulfilled'&&r.value.ok);assert.equal((await book(customers[winner],ids[winner])).status,200);assert.equal(await db.ticket.count(),1);
 console.log('PASS: simultaneous portal bookings accept one opening once; retry preserves the same ticket.');
 // Repeated submits at a second opening exercise the production locking path under contention.
 start=new Date(+start+2*3600000);const batchIds=Array.from({length:12},()=>randomUUID());
 const burst=await Promise.allSettled(batchIds.map((id,i)=>book(customers[i%2],id)));
 assert.equal(burst.filter(r=>r.status==='fulfilled'&&r.value.ok).length,1);
 assert.equal(await db.ticket.count(),2);
 console.log('PASS: twelve simultaneous requests for a second opening create one appointment.');
 const beforeCount=await db.ticket.count();

 await bootstrap(db,plan);assert.equal(await db.ticket.count(),beforeCount);assert.equal(await db.customer.count(),2);
 await db.$executeRawUnsafe('DROP TABLE EmployeeSchedule');await bootstrap(db,plan);await verify(db,plan);assert.equal(await db.ticket.count(),beforeCount);
 console.log('PASS: repeated and interrupted-schema recovery preserve fictional customer and ticket records.');

 const second=await db.location.create({data:{tenantId,name:'Second fictional shop',timezone:'UTC'}});
 const employee=await db.user.create({data:{tenantId,locationId,firstName:'Test',lastName:'Groomer',role:'GROOMER',pinHash:'not-a-valid-pin'}});
 await db.tenantSetting.create({data:{tenantId,settingKey:'EMPLOYEE_AVAILABLE_ONLINE:'+employee.id,value:true}});
 const shift=randomUUID();await db.$executeRaw`INSERT INTO EmployeeSchedule (id,tenantId,userId,dayOfWeek,startTime,endTime) VALUES (${shift},${tenantId},${employee.id},${start.getUTCDay()},'08:00','18:00')`;
 const {portalAvailability}=require('../src/lib/portal-availability.ts');const date=start.toISOString().slice(0,10);
 const available=async shop=>(await portalAvailability(tenantId,shop,date,60,'GR',db)).available(start).some(r=>r.id===employee.id);
 assert.equal(await available(locationId),true);assert.equal(await available(second.id),false);
 await db.tenantSetting.create({data:{tenantId,settingKey:'EMPLOYEE_SHIFT_LOCATION:'+shift,value:{locationId:second.id}}});
 assert.equal(await available(locationId),false);assert.equal(await available(second.id),true);
 const busy=await db.ticket.create({data:{tenantId,locationId,customerId:customers[0].c.id,orderNumber:900,scheduledStart:start,durationMin:60,assignments:{create:{userId:employee.id,role:'GROOMER'}}}});
 assert.equal(await available(second.id),false);
 await db.ticket.update({where:{id:busy.id},data:{status:'CANCELLED'}});assert.equal(await available(second.id),true);
 console.log('PASS: online employee hours follow the assigned shop; another shop’s active booking blocks overlapping availability without exposing customer details.');

 const {actionContext}=require('../src/lib/action-context.ts');const staffSession={id:'local-approved-session',user:{id:employee.id,role:'GROOMER',active:true}};
 const staffStart=new Date(+start+86400000);if(staffStart.getUTCDay()===0)staffStart.setUTCDate(staffStart.getUTCDate()+1);
 const staffBody={customerId:customers[0].c.id,petIds:[customers[0].pet.id],lines:[{type:'SERVICE',id:service.id,petId:customers[0].pet.id}],scheduledStart:staffStart.toISOString(),bookingSource:'STAFF'};
 const staffBook=overrides=>actionContext.run({tenantId,session:staffSession},()=>createTicket(new NextRequest('http://localhost/api/tickets?locationId='+locationId,{method:'POST',headers:{'x-tenant-id':tenantId,cookie:'groompro_session='+staffSession.id,...(overrides?{'x-groompro-scheduling-overrides':encodeURIComponent(JSON.stringify(overrides))}:{})},body:JSON.stringify(staffBody)})));
 const staffResults=await Promise.all([staffBook(),staffBook()]);assert.deepEqual(staffResults.map(r=>r.status).sort(),[200,409]);
 const warning=await staffResults.find(r=>r.status===409).json();assert.ok(warning.schedulingWarning);
 const accepted=await staffBook([warning.schedulingWarning]);assert.equal(accepted.status,200);
 console.log('PASS: simultaneous staff bookings require the overlap warning; the existing authorized override still works.');
 const toMove=await db.ticket.findMany({where:{tenantId,scheduledStart:staffStart,customerId:customers[0].c.id}});assert.equal(toMove.length,2);
 const movedStart=new Date(+staffStart+2*86400000);if(movedStart.getUTCDay()===0)movedStart.setUTCDate(movedStart.getUTCDate()+1);
 const {PATCH}=require('../src/lib/actions/ticket-booking.ts');
 const moveResults=await Promise.all(toMove.map(t=>actionContext.run({tenantId,session:staffSession},()=>PATCH(new NextRequest('http://localhost/api/tickets?locationId='+locationId,{method:'PATCH',headers:{'x-tenant-id':tenantId,cookie:'groompro_session='+staffSession.id},body:JSON.stringify({ticketId:t.id,scheduledStart:movedStart.toISOString(),expectedStart:staffStart.toISOString()})})))));
 assert.deepEqual(moveResults.map(r=>r.status).sort(),[200,409]);assert.equal(await db.ticket.count({where:{tenantId,scheduledStart:movedStart,customerId:customers[0].c.id}}),1);
 console.log('PASS: simultaneous moves to one customer time retain the overlap warning.');

 if(process.env.TEST_DATABASE_BIN){
  const {execFileSync}=require('node:child_process');
  const bin=path.resolve(process.env.TEST_DATABASE_BIN),dump=path.resolve(process.env.TEST_DATABASE_DUMP||'../audit-local-db/restore.sql');
  const auth=['--host=127.0.0.1','--port='+url.port,'--user='+decodeURIComponent(url.username),'--password='+decodeURIComponent(url.password)];
  execFileSync(path.join(bin,'mariadb-dump.exe'),[...auth,'--single-transaction','--result-file='+dump,url.pathname.slice(1)],{windowsHide:true});
  const restored=url.pathname.slice(1).replace(/_test$/,'_restore_test');
  const connection=await mysql.createConnection({host:url.hostname,port:Number(url.port),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password)});
  await connection.query('CREATE DATABASE `'+restored+'`');await connection.end();
  execFileSync(path.join(bin,'mariadb.exe'),[...auth,restored],{input:fs.readFileSync(dump),windowsHide:true});
  const {PrismaClient}=require('@prisma/client'),copyUrl=new URL(url);copyUrl.pathname='/'+restored;
  const copy=new PrismaClient({datasources:{db:{url:copyUrl.href}}});
  try{await verify(copy,plan);assert.deepEqual(await copy.ticket.findMany({include:{lines:true,pets:true}}),await db.ticket.findMany({include:{lines:true,pets:true}}));assert.deepEqual(await copy.customer.findMany(),await db.customer.findMany());assert.equal(await copy.auditEntry.count(),await db.auditEntry.count());console.log('PASS: full SQL backup restored into a separate database; customers, tickets, lines, pets and audit count match.');}finally{await copy.$disconnect();}
 }

 }finally{await db.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
