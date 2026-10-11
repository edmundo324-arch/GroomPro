const assert=require('node:assert/strict');
const {randomBytes,scryptSync,createHash,randomUUID}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
const {bootstrap,schemaPlan}=require('./bootstrap-godaddy.cjs');
async function main(){
 const url=new URL(process.env.TEST_DATABASE_URL||'');assert.match(url.pathname,/_test$/);
 process.env.DATABASE_URL=url.href;const db=new PrismaClient();let server;
 const hash=pin=>{const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(pin,salt,64).toString('hex')};
 const prefixes=pin=>Array.from({length:pin.length-3},(_,i)=>hash(pin.slice(0,i+3)));
 try{
  await bootstrap(db,schemaPlan(fs.readFileSync(path.join(__dirname,'../godaddy-groompro-schema.sql'),'utf8')));
  const tenant=await db.tenant.create({data:{name:'PIN POS verification'}}),other=await db.tenant.create({data:{name:'Separate tenant'}});
  const location=await db.location.create({data:{tenantId:tenant.id,name:'Verification location',timezone:'America/Chicago'}});
  const manager=await db.user.create({data:{tenantId:tenant.id,locationId:location.id,firstName:'Manager',lastName:'Test',role:'MANAGER',pinHash:hash('948672')}});
  const staff=await db.user.create({data:{tenantId:tenant.id,locationId:location.id,firstName:'Staff',lastName:'Test',role:'FRONT',pinHash:hash('745193'),pinPrefixHashes:prefixes('745193')}});
  const customer=await db.customer.create({data:{tenantId:tenant.id,firstName:'PIN',lastName:'Customer'}});
  const pet=await db.pet.create({data:{tenantId:tenant.id,customerId:customer.id,name:'Test Dog'}});
  const service=await db.service.create({data:{tenantId:tenant.id,name:'Test grooming',priceCents:1000,durationMin:30}});
  const port=process.env.TEST_PIN_PORT||'3120',base=process.env.TEST_BASE_URL||`http://127.0.0.1:${port}`;
  if(!process.env.TEST_BASE_URL){server=spawn(process.execPath,[path.join(__dirname,'godaddy-start.cjs'),...(process.env.TEST_RUNTIME==='preview'?['--dev']:[])],{cwd:path.join(__dirname,'..'),env:{...process.env,DATABASE_URL:url.href,PORT:port,NODE_ENV:'production'},stdio:'inherit'});for(let i=0;i<90;i++){try{if((await fetch(base+'/api/health')).ok)break}catch{}if(server.exitCode!==null)throw Error('Server stopped');await new Promise(r=>setTimeout(r,1000))}}
  let cookie='';
  async function call(route,method='GET',body,extra={}){const r=await fetch(base+route,{method,headers:{'x-tenant-id':tenant.id,'content-type':'application/json',cookie,...extra},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();const jar=new Map(cookie.split('; ').filter(Boolean).map(v=>v.split('=')));for(const c of r.headers.getSetCookie()){const [k,v]=c.split(';')[0].split('=');jar.set(k,v)}cookie=[...jar].map(([k,v])=>k+'='+v).join('; ');return {status:r.status,data}}
  async function ok(route,method,body,headers){const r=await call(route,method,body,headers);assert.ok(r.status<300,JSON.stringify(r));return r.data}
  assert.equal((await call('/api/employee/session','POST',{pin:'000'})).status,401);
  const pending=await ok('/api/employee/session','POST',{pin:'745193',automatic:true});assert.equal(pending.pending,true);assert.match(pending.message,/Continue/);
  await ok('/api/employee/session','POST',{pin:'948672'});assert.ok(Array.isArray((await db.user.findUnique({where:{id:manager.id}})).pinPrefixHashes));
  assert.equal((await ok('/api/employee/session','POST',{pin:'745193',automatic:true})).employee.id,staff.id);
  const workingCookie=cookie;
  const adjustment={customerId:customer.id,entryType:'CREDIT',amountCents:10,reason:'Manager approval verification'};
  assert.equal((await call('/api/customers/account','POST',adjustment)).status,403);
  const requestHash=createHash('sha256').update('POST\n/api/customers/account\n'+JSON.stringify(adjustment)).digest('hex');
  assert.equal((await call('/api/employee/session','POST',{pin:'745193',mode:'APPROVAL',requestHash})).status,403);
  const approval=(await ok('/api/employee/session','POST',{pin:'948672',mode:'APPROVAL',requestHash})).approval;assert.equal(cookie,workingCookie);
  assert.equal((await call('/api/customers/account','POST',{...adjustment,amountCents:999},{'x-groompro-approval':approval})).status,401);
  assert.equal((await call('/api/customers/account','POST',adjustment,{'x-tenant-id':other.id,'x-groompro-approval':approval})).status,401);
  await ok('/api/customers/account','POST',adjustment,{'x-groompro-approval':approval});
  assert.equal((await ok('/api/employee/session')).employee.id,staff.id);
  assert.equal((await call('/api/customers/account','POST',adjustment,{'x-groompro-approval':approval})).status,401);
  assert.equal((await db.customer.findUnique({where:{id:customer.id}})).creditCents,10);
  assert.ok(await db.auditEntry.findFirst({where:{tenantId:tenant.id,actorUserId:manager.id,action:'APPROVE_ACTION'}}));
  await db.tenantSetting.create({data:{tenantId:tenant.id,settingKey:'WORKFLOW',value:{securityMode:'PER_ACTION',inactivityMinutes:30}}});
  await ok('/api/employee/session','POST',{pin:'745193',automatic:true});
  const draft={customerId:customer.id,petIds:[pet.id],lines:[{type:'SERVICE',id:service.id,petId:pet.id,quantity:1}],tipCents:200,salesTaxCents:100};
  const pay={kind:'PAYMENT',requestKey:randomUUID(),draft,details:{paymentType:'CASH',amountCents:1300,tipCents:200,salesTaxCents:100}};
  const paid=await ok('/api/pos-operation','POST',pay);assert.equal(paid.dueCents,0);assert.equal(await db.payment.count({where:{ticketId:paid.ticket.id}}),1);
  assert.equal((await call('/api/pos-operation','POST',{kind:'CLOSE',requestKey:randomUUID(),ticketId:paid.ticket.id})).status,401);
  await ok('/api/employee/session','POST',{pin:'745193'});
  assert.equal((await ok('/api/pos-operation','POST',pay)).ticket.id,paid.ticket.id);assert.equal(await db.payment.count({where:{ticketId:paid.ticket.id}}),1);
  await ok('/api/employee/session','POST',{pin:'745193'});
  await ok('/api/pos-operation','POST',{kind:'CLOSE',requestKey:randomUUID(),ticketId:paid.ticket.id,details:{tipCents:200,salesTaxCents:100}});
  assert.equal((await db.ticket.findUnique({where:{id:paid.ticket.id}})).status,'CLOSED');
  await db.tenantSetting.update({where:{tenantId_settingKey:{tenantId:tenant.id,settingKey:'WORKFLOW'}},data:{value:{securityMode:'INACTIVITY',inactivityMinutes:30}}});
  const save={kind:'SAVE',requestKey:randomUUID(),draft};const before=await db.ticket.count({where:{tenantId:tenant.id}});
  const concurrent=await Promise.all([call('/api/pos-operation','POST',save),call('/api/pos-operation','POST',save)]);assert.ok(concurrent.some(r=>r.status===200));assert.equal(await db.ticket.count({where:{tenantId:tenant.id}}),before+1);
  assert.equal((await call('/api/pos-operation','POST',{...save,draft:{...draft,notes:'changed'}})).status,409);
  const repeat=await ok('/api/pos-operation','POST',save);assert.ok(repeat.ticket.orderNumber);
  const rebooking={kind:'REBOOK',requestKey:randomUUID(),ticketId:repeat.ticket.id,details:{scheduledStart:'2030-10-14T15:00:00.000Z',confirmRecentWarning:true}};
  const rebooked=await ok('/api/pos-operation','POST',rebooking);assert.notEqual(rebooked.ticket.id,repeat.ticket.id);assert.equal((await ok('/api/pos-operation','POST',rebooking)).ticket.id,rebooked.ticket.id);
  const session=(await db.employeeSession.findFirst({where:{tenantId:tenant.id,userId:staff.id,endedAt:null}}));await db.employeeSession.update({where:{id:session.id},data:{lastActiveAt:new Date(Date.now()-3600000)}});
  assert.equal((await ok('/api/employee/session')).employee,null);assert.equal((await call('/api/pos-operation','POST',{...save,requestKey:randomUUID()})).status,401);
  await ok('/api/employee/session','POST',{pin:'948672',mode:'SWITCH'});assert.equal((await ok('/api/employee/session')).employee.id,manager.id);
  assert.ok((await db.employeeSession.findUnique({where:{id:session.id}})).endedAt);
  console.log('PASS: shared PIN API, legacy upgrade, automatic sign-in, scoped manager approval, unchanged employee session, tamper/replay/tenant rejection, per-action composite payment, idempotent save/payment/rebook, close, expiry and switch.');
 }finally{if(server)server.kill();await db.$disconnect()}
}
main().catch(e=>{console.error(e);process.exitCode=1});

