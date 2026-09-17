const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomBytes, scryptSync } = require('node:crypto');
const mysql = require('mysql2/promise');
const { PrismaClient } = require('@prisma/client');
const { ROOT } = require('./database-config.cjs');
const { schemaPlan, bootstrap, verify, statements } = require('./bootstrap-godaddy.cjs');

async function main() {
  const url = new URL(process.env.TEST_DATABASE_URL || '');
  assert.match(url.pathname, /_test$/, 'Only an explicitly configured disposable *_test database is allowed.');
  process.env.DATABASE_URL = url.href;
  const db = new PrismaClient();
  let server;
  let seedServer;
  let seedDb;
  try {
    const existing = await db.$queryRaw`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()`;
    assert.equal(existing.length, 0, 'Integration database must start empty.');
    const sql = fs.readFileSync(path.join(ROOT, 'godaddy-groompro-schema.sql'), 'utf8');
    const plan = schemaPlan(sql);
    assert.ok(await bootstrap(db, plan) > 40);
    const tenant = await db.tenant.create({data:{name:'Database integration test'}});
    const location = await db.location.create({data:{tenantId:tenant.id,name:'Test location'}});
    const salt = randomBytes(16).toString('hex');
    const user = await db.user.create({data:{tenantId:tenant.id,locationId:location.id,firstName:'Test',lastName:'Employee',pinHash:`${salt}:${scryptSync('918273',salt,64).toString('hex')}`,role:'ADMIN'}});
    const customer = await db.customer.create({data:{tenantId:tenant.id,firstName:'Existing',lastName:'Customer',creditCents:1234}});
    await db.ticket.create({data:{tenantId:tenant.id,locationId:location.id,customerId:customer.id,orderNumber:1,status:'NO_SHOW',accountCreditCents:123}});
    await bootstrap(db, plan);
    assert.equal((await db.customer.findUnique({where:{id:customer.id}})).creditCents, 1234);
    assert.equal(await db.ticket.count(), 1);
    // Simulate interrupted/older setup in this disposable test database.
    await db.$executeRawUnsafe('DROP TABLE EmployeeSchedule');
    await db.$executeRawUnsafe('ALTER TABLE User DROP COLUMN jobTitle');
    await db.ticket.updateMany({data:{status:'CONFIRMED'}});
    await db.$executeRawUnsafe("ALTER TABLE `Ticket` MODIFY COLUMN `status` ENUM('OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY','CLOSED','CANCELLED') NOT NULL DEFAULT 'OPEN'");
    await bootstrap(db, plan);
    await verify(db, plan);
    assert.equal((await db.ticket.findFirst()).status, 'CONFIRMED');
    await db.ticket.updateMany({data:{status:'NO_SHOW'}});
    // Exercise the actual exported import artifact independently of bootstrap.
    const connection = await mysql.createConnection({host:url.hostname,port:Number(url.port||3306),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password)});
    const importName = url.pathname.slice(1).replace(/_test$/, '_import_test');
    assert.match(importName, /^[a-zA-Z0-9_]+$/);
    try {
      await connection.query(`CREATE DATABASE \`${importName}\``);
      await connection.changeUser({database:importName});
      for (const statement of statements(sql)) await connection.query(statement);
      const [tables] = await connection.query('SHOW TABLES');
      assert.equal(tables.length, plan.tables.length);
    } finally { await connection.end(); }
    const port = process.env.TEST_PORT || '3100';
    const env = {...process.env,NODE_ENV:'production',PORT:port};
    // Use split variables for the real start path, URL-only was exercised above.
    delete env.DATABASE_URL;
    Object.assign(env,{DB_HOST:url.hostname,DB_PORT:url.port||'3306',DB_USER:decodeURIComponent(url.username),DB_PASSWORD:decodeURIComponent(url.password),DB_NAME:url.pathname.slice(1)});
    const runtimeArgs = process.env.TEST_RUNTIME === 'preview' ? ['--dev'] : [];
    server = spawn(process.execPath, [path.join(ROOT,'scripts/godaddy-start.cjs'), ...runtimeArgs], {cwd:ROOT,env,stdio:'inherit'});
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i=0;i<90;i++) {
      if (server.exitCode !== null) throw new Error('Runtime exited before readiness.');
      try { const r=await fetch(`${base}/api/health`); if(r.ok){ready=true;break;} } catch {}
      await new Promise(r=>setTimeout(r,1000));
    }
    assert.ok(ready, 'Runtime did not become ready.');
    let cookie = '';
    async function api(route, method='GET', body) {
      const response=await fetch(base+route,{method,headers:{'x-tenant-id':tenant.id,'Content-Type':'application/json',cookie},body:body?JSON.stringify(body):undefined});
      const json=await response.json();
      assert.ok(response.ok, `${method} ${route}: ${response.status} ${JSON.stringify(json)}`);
      const cookies=response.headers.getSetCookie();
      if(cookies.length) cookie=cookies.map(c=>c.split(';')[0]).join('; ');
      return json;
    }
    assert.equal((await api('/api/health')).tableCount, plan.tables.length);
    await api('/api/employee/session','POST',{pin:'918273'});
    const created=await api('/api/customers','POST',{firstName:'API',lastName:'Customer',phone:'2105550199'});
    assert.equal((await db.customer.findUnique({where:{id:created.customer.id}})).firstName,'API');
    await api('/api/products','POST',{name:'API Test Product',sku:'integration-product',quantity:7,priceCents:1250});
    assert.equal((await db.product.findFirst({where:{tenantId:tenant.id}})).quantity,7);
    assert.equal((await api('/api/products')).products.length,1);
    await api('/api/employee-schedules','PUT',{userId:user.id,dayOfWeek:1,startTime:'08:30',endTime:'17:00'});
    assert.equal((await api('/api/employee-schedules')).schedules.length,1);
    assert.equal((await api(`/api/customers/account?customerId=${customer.id}`)).customer.paymentMethodCount, 0);
    await api('/api/customers/account','POST',{customerId:customer.id,entryType:'CREDIT',amountCents:-234,reason:'Integration verification'});
    assert.equal((await db.customer.findUnique({where:{id:customer.id}})).creditCents,1000);
    // A completely empty business database must be initialized through the
    // actual protected seed API, then work using cookies alone (no tenant header).
    const seedUrl=new URL(url);seedUrl.pathname='/'+importName;
    seedDb=new PrismaClient({datasources:{db:{url:seedUrl.href}}});
    const seedPort=String(Number(port)+1),seedBase='http://127.0.0.1:'+seedPort;
    const setupSecret=randomBytes(24).toString('hex');
    seedServer=spawn(process.execPath,[path.join(ROOT,'scripts/godaddy-start.cjs'),...runtimeArgs],{cwd:ROOT,env:{...env,DB_NAME:importName,PORT:seedPort,GROOMPRO_SETUP_SECRET:setupSecret},stdio:'inherit'});
    let seedReady=false;
    for(let i=0;i<90;i++){if(seedServer.exitCode!==null)throw new Error('Seed runtime stopped');try{if((await fetch(seedBase+'/api/health')).ok){seedReady=true;break}}catch{}await new Promise(r=>setTimeout(r,1000))}
    assert.ok(seedReady);
    const emptyContext=await (await fetch(seedBase+'/api/setup/context')).json();
    assert.equal(emptyContext.setupRequired,true);
    let seedCookie='';
    async function seedApi(route,method='GET',body){
      const r=await fetch(seedBase+route,{method,headers:{'Content-Type':'application/json',cookie:seedCookie},body:body?JSON.stringify(body):undefined});
      const text=await r.text();assert.ok(r.ok,method+' '+route+': '+r.status+' '+text);
      const cookies=r.headers.getSetCookie();if(cookies.length){const jar=new Map(seedCookie.split('; ').filter(Boolean).map(c=>c.split('=')));for(const c of cookies){const [name,value]=c.split(';')[0].split('=');jar.set(name,value)}seedCookie=[...jar].map(([k,v])=>k+'='+v).join('; ')}
      return JSON.parse(text);
    }
    const denied=await fetch(seedBase+'/api/setup/seed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:'invalid'})});
    assert.equal(denied.status,401);assert.equal(await seedDb.tenant.count(),0);
    const seeded=await seedApi('/api/setup/seed','POST',{secret:setupSecret});
    assert.equal(seeded.seeded.employeeCount,11);assert.equal(seeded.seeded.customerCount,100);
    assert.equal(await seedDb.tenant.count(),1);assert.equal(await seedDb.customer.count(),100);assert.equal(await seedDb.pet.count(),100);
    assert.equal(await seedDb.user.count(),11);assert.ok(await seedDb.ticket.count()>0);
    const saved=await seedDb.user.findFirst();const changedPin='preserve-existing-pin';
    await seedDb.user.update({where:{id:saved.id},data:{pinHash:changedPin}});
    const ticketsBefore=await seedDb.ticket.count();
    await seedApi('/api/setup/seed','POST',{secret:setupSecret});
    assert.equal(await seedDb.customer.count(),100);assert.equal(await seedDb.user.count(),11);assert.equal(await seedDb.ticket.count(),ticketsBefore);
    assert.equal((await seedDb.user.findUnique({where:{id:saved.id}})).pinHash,changedPin);
    seedCookie=''; // Model a second browser opening the single-business app.
    assert.equal((await seedApi('/api/setup/context')).setupRequired,false);
    assert.ok(seedCookie.includes('groompro_tenant='));
    assert.equal((await seedApi('/api/employees')).employees.length,11);
    await seedApi('/api/employees','POST',{firstName:'Added',lastName:'Employee',role:'FRONT',pin:'817263'});
    assert.equal(await seedDb.user.count(),12);
    assert.equal((await seedApi('/api/locations')).locations.length,1);
    assert.equal((await seedApi('/api/employee-schedules')).schedules.length,55);
    await seedApi('/api/setup/seed-schedules','POST',{secret:setupSecret});
    assert.equal((await seedApi('/api/employee-schedules')).schedules.length,55);
    const assets=await seedApi('/api/booking-assets');assert.equal(assets.assets.length,8);assert.ok(assets.assets.every(a=>a.schedules.length===6));
    const sample=await seedDb.ticket.findFirst({where:{scheduledStart:{not:null}},orderBy:{scheduledStart:'asc'}});
    const start=new Date(sample.scheduledStart);start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+1);
    const calendar=await seedApi('/api/calendar?start='+encodeURIComponent(start.toISOString())+'&end='+encodeURIComponent(end.toISOString()));
    assert.equal(calendar.employees.length,12);assert.equal(calendar.assets.length,8);assert.equal(calendar.employeeSchedules.length,55);assert.equal(calendar.assetSchedules.length,48);assert.ok(calendar.tickets.some(t=>t.id===sample.id&&t.durationMin>0));
    assert.equal((await seedApi('/api/tickets/'+sample.id)).ticket.id,sample.id);
    const deniedMove=await fetch(seedBase+'/api/tickets',{method:'PATCH',headers:{'Content-Type':'application/json',cookie:seedCookie},body:JSON.stringify({ticketId:sample.id,scheduledStart:sample.scheduledStart})});assert.equal(deniedMove.status,401);assert.match((await deniedMove.json()).error,/Employee PIN/);
    await seedApi('/api/employee/session','POST',{pin:'817263'});
    const moved=new Date(+new Date(sample.scheduledStart)+15*60000).toISOString();
    await seedApi('/api/tickets','PATCH',{ticketId:sample.id,scheduledStart:moved});
    assert.equal((await seedDb.ticket.findUnique({where:{id:sample.id}})).scheduledStart.toISOString(),moved);
    assert.equal((await seedApi('/api/tickets/checkout?ticketId='+sample.id)).ticket.id,sample.id);
    console.log('PASS: calendar employees/assets/schedules and clickable ticket data; cookie-only PIN and appointment move persist to MySQL.');
    await seedDb.tenant.create({data:{name:'Second business'}});
    const ambiguous=await fetch(seedBase+'/api/setup/context');assert.equal(ambiguous.status,409);
    console.log('PASS: complete seed; cookie-only employee creation; restored business context; 100 customers; 11 seeded employees; 55 employee schedules; 48 asset schedules; repeat seed preserves PINs and appointments.');
    console.log(`PASS: ${plan.tables.length} tables; SQL import; repeat and partial bootstrap; preserved data; production startup; API writes and database reads.`);
  } finally {
    if(server) server.kill('SIGTERM');
    if(seedServer) seedServer.kill('SIGTERM');
    if(seedDb) await seedDb.$disconnect();
    await db.$disconnect();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});

