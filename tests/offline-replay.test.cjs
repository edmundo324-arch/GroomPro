const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

function load(name, dependencies) {
  const source = readFileSync(path.join(__dirname, '../src/lib', name + '.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('require', 'exports', js)(key => key === 'node:crypto' ? require(key) : dependencies[key], exports);
  return exports;
}

test('offline receipts prevent duplicate writes and keep failed saves and conflicts atomic', async () => {
  const actions = load('offline-actions', {});
  let record = { id: 'customer', firstName: 'Before', updatedAt: new Date('2026-11-07T14:00:00Z') };
  let receipts = new Map();
  let calls = 0;
  let failReceipt = false;
  let working;
  const { replayOffline } = load('offline-replay', {
    '@prisma/client': { Prisma: { TransactionIsolationLevel: { Serializable: 'Serializable' } } },
    'next/server': { NextResponse: { json: Response.json } },
    './offline-actions': actions,
    './offline-transaction': { offlineTransaction: { run: (_scope, invoke) => invoke() } },
    './request-location': { requestLocation: async () => 'location' },
    './db': { db: { $transaction: async (action, options) => {
      assert.equal(options.isolationLevel, 'Serializable');
      const pending = new Map(receipts);
      working = { ...record };
      const response = await action({
        $queryRaw: async () => [],
        customer: { findFirst: async () => working },
        posOperation: {
          findUnique: async ({ where }) => pending.get(where.tenantId_requestKey.requestKey),
          create: async ({ data }) => {
            if (failReceipt) throw Error('Simulated failure before commit');
            pending.set(data.requestKey, data);
          },
        },
      });
      record = working;
      receipts = pending;
      return response;
    } } },
  });
  const version = record.updatedAt.toISOString();
  const request = (id, value, expected = version, employeeId = 'employee') => {
    const metadata = { id, tenantId: 'tenant', locationId: 'location', employeeId, version: expected };
    const url = 'https://groompro.test/api/customers/customer';
    const req = new Request(url, { method: 'PATCH', body: JSON.stringify({ firstName: value }),
      headers: { 'x-groompro-offline': encodeURIComponent(JSON.stringify(metadata)) } });
    req.nextUrl = new URL(url);
    return replayOffline(req, 'tenant', 'employee', async () => {
      calls++;
      working.firstName = value;
      working.updatedAt = new Date('2026-11-07T14:05:00Z');
      // Some handlers take a response snapshot before their final update.
      return Response.json({ customer: { ...working, updatedAt: version } });
    });
  };
  const id = '12345678-1234-1234-1234-123456789abc';
  const other = '87654321-1234-1234-1234-123456789abc';
  const first = await request(id, 'Edit');
  assert.equal(first.status, 200);
  assert.equal((await first.json()).offlineVersions['customer:customer'], record.updatedAt.toISOString());
  assert.equal((await request(id, 'Edit')).status, 200);
  assert.equal(calls, 1);
  assert.equal((await request(id, 'Different')).status, 409);
  assert.equal((await request(other, 'Stale')).status, 409);
  assert.equal((await request(other, 'Wrong employee', version, 'someone-else')).status, 403);
  assert.equal(calls, 1);
  failReceipt = true;
  assert.equal((await request(other, 'Unconfirmed', record.updatedAt.toISOString())).status, 503);
  assert.equal(record.firstName, 'Edit');
  assert.equal(receipts.size, 1);
});

test('only validated offline check-ins carry their recorded time into the status action',async()=>{
 const actions=load('offline-actions',{}),now=Date.now(),record={id:'ticket',createdAt:new Date(now-86400000),updatedAt:new Date(now-3600000)},contexts=[];
 const tx={$queryRaw:async()=>[],ticket:{findFirst:async()=>record},posOperation:{findUnique:async()=>null,create:async()=>{}}};
 const {replayOffline}=load('offline-replay',{'@prisma/client':{Prisma:{TransactionIsolationLevel:{Serializable:'Serializable'}}},'next/server':{NextResponse:{json:Response.json}},'./offline-actions':actions,'./request-location':{requestLocation:async()=> 'location'},'./offline-transaction':{offlineTransaction:{run:(scope,invoke)=>{contexts.push(scope);return invoke()}}},'./db':{db:{$transaction:async run=>run(tx)}}});
 async function replay(createdAt,extra={},details={status:'CHECKED_IN'}){const url='https://groompro.test/api/pos-operation',metadata={id:require('node:crypto').randomUUID(),tenantId:'tenant',locationId:'location',employeeId:'employee',version:record.updatedAt.toISOString(),createdAt,...extra};const request=new Request(url,{method:'POST',headers:{'x-groompro-offline':encodeURIComponent(JSON.stringify(metadata))},body:JSON.stringify({kind:'STATUS',ticketId:'ticket',details})});request.nextUrl=new URL(url);return replayOffline(request,'tenant','employee',async()=>Response.json({ticket:record}));}
 const recorded=now-1800000;assert.equal((await replay(recorded)).status,200);assert.equal(+contexts.at(-1).checkedInAt,recorded);
 assert.equal((await replay(recorded,{live:true})).status,200);assert.equal(contexts.at(-1).checkedInAt,undefined,'Direct online check-in uses server time');
 assert.equal((await replay(recorded,{}, {status:'READY'})).status,200);assert.equal(contexts.at(-1).checkedInAt,undefined,'Other status timestamps are unchanged');
 const accepted=contexts.length;for(const bad of [0,now+3600000,now-172800000,'yesterday',null])assert.equal((await replay(bad)).status,409);assert.equal(contexts.length,accepted,'Invalid timestamps never reach a mutation');
 assert.equal((await replay(recorded,{employeeId:'someone-else'})).status,403);assert.equal(contexts.length,accepted,'Scope checks still precede device-time acceptance');
});
