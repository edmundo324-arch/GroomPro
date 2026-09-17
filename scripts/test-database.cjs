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
    console.log(`PASS: ${plan.tables.length} tables; SQL import; repeat and partial bootstrap; preserved data; production startup; API writes and database reads.`);
  } finally {
    if(server) server.kill('SIGTERM');
    await db.$disconnect();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
