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
      return Response.json({ customer: working });
    });
  };
  const id = '12345678-1234-1234-1234-123456789abc';
  const other = '87654321-1234-1234-1234-123456789abc';
  assert.equal((await request(id, 'Edit')).status, 200);
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
