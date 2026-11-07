// Focused round-trip check with fictional records. Set GROOMPRO_TEST_CHROME
// to use real browser storage. Without it, simulate restart with shared storage.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { readFileSync, mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { createServer } = require('node:http');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

const source = path.resolve(__dirname, '../src/lib');
const modules = new Map();
function bundle(name) {
  if (modules.has(name)) return;
  if (name.endsWith('.json')) {
    modules.set(name, 'module.exports = ' + readFileSync(path.resolve(source, name), 'utf8') + ';');
    return;
  }
  const file = path.resolve(source, name + '.ts');
  const js = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  modules.set(name, js);
  for (const [, dependency] of js.matchAll(/require\("\.\/([^"]+)"\)/g)) bundle(dependency);
}
bundle('offline-device');
const loader = `const modules = {${[...modules].map(([name, js]) => `${JSON.stringify(name)}:(require,exports,module)=>{${js}}`).join(',')}};
const loaded = {};
function require(name) {
  name = name.replace(/^\\.\\//, '');
  if (!loaded[name]) {
    const module = loaded[name] = {exports:{}};
    modules[name](require, module.exports, module);
  }
  return loaded[name].exports;
}`;

const scope = { tenantId: 'offline-test-tenant', locationId: 'offline-test-location', employeeId: 'offline-test-employee' };
const appointmentTime = '2026-11-08T15:00:00.000Z';
const employee = { id: scope.employeeId, firstName: 'Offline', lastName: 'Test', role: 'ADMIN' };
const serverRecords = { customers: [], drafts: [], tickets: [], notes: [] };
const receipts = new Map();
const lostReplies = new Set();
let creates = 0;
let result;
const browser = `
const assert = (truth,message) => { if(!truth) throw Error(message); };
const api = require('offline-device');
const scope = ${JSON.stringify(scope)};
const appointmentTime = ${JSON.stringify(appointmentTime)};
let online = true;
Object.defineProperty(navigator, 'onLine', { get: () => online });
const save = async (url, payload, method='POST') => {
  const response = await api.deviceFetch(url, {method,body:JSON.stringify(payload)});
  const data = await response.json();
  assert(response.status === 202, data.error || 'Offline save failed');
  return data;
};
(async()=>{
  if (!sessionStorage.getItem('offline-reload')) {
    await api.prepareOffline(scope);
    assert((await api.offlineStatus()).ready, 'Offline data did not prepare');
    const {customer} = await save('/api/customers',{firstName:'Fictional',lastName:'Customer'});
    online = false;
    const {pet} = await save('/api/pets',{customerId:customer.id,name:'Fluffy'});
    const {draft} = await save('/api/pos-drafts',{requestKey:crypto.randomUUID()});
    const {ticket} = await save('/api/pos-operation',{kind:'SAVE',requestKey:crypto.randomUUID(),draft:{draftId:draft.id,
      customerId:customer.id,petIds:[pet.id],scheduledStart:appointmentTime,lines:[{type:'SERVICE',id:'service',petId:pet.id}]}});
    await save('/api/pets',{id:pet.id,customerId:customer.id,name:'Fluffy Updated'},'PATCH');
    sessionStorage.setItem('offline-reload',JSON.stringify({customerId:customer.id,petId:pet.id,ticketId:ticket.id}));
    location.reload();
    return;
  }
  const ids = JSON.parse(sessionStorage.getItem('offline-reload'));
  online = false;
  assert((await api.offlineBootstrap())?.employee.id === scope.employeeId,'Employee did not restore');
  const profile = await (await api.deviceFetch('/api/customers/'+ids.customerId)).json();
  assert(profile.customer.pets[0].id===ids.petId && profile.customer.pets[0].name==='Fluffy Updated','Local pet did not survive reload');
  assert(profile.customer.tickets[0].id===ids.ticketId && profile.customer.tickets[0].lines[0].petId===ids.petId,'Local appointment lost its linked pet');
  assert((await api.offlineStatus()).pending.length===5,'Pending changes did not survive reload');
  online = true;
  await api.syncOffline();
  assert((await api.offlineStatus()).pending.length===4,'A missing acknowledgement removed a pending edit');
  await api.syncOffline();
  assert((await api.offlineStatus()).pending.length===0,'Reconnection left changes pending');
  await fetch('/result',{method:'POST',body:'passed'});
})().catch(error=>fetch('/result',{method:'POST',body:error.stack || error.message}));
`;

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://local').pathname;
  if (pathname === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><meta charset="UTF-8"><script>' + loader + '\n' + browser + '</script>');
    return;
  }
  const reply = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
  if (req.method === 'GET') {
    if (pathname === '/api/offline/snapshot') {
      return reply({ scope, employee, ...serverRecords, start: '2026-11-07T06:00:00.000Z', since: '2026-07-18T05:00:00.000Z',
        through: '2026-12-08T06:00:00.000Z', location: { id: scope.locationId, name: 'Test', timezone: 'America/Chicago' }, fetchedAt: Date.now() });
    }
    if (pathname === '/api/catalog') return reply({ services: [{ id: 'service', name: 'Bath', priceCents: 2000, durationMin: 30, active: true }] });
    return reply({});
  }
  let text = '';
  for await (const chunk of req) text += chunk;
  if (pathname === '/result') { result?.(text); res.end('ok'); return; }
  try {
    const metadata = JSON.parse(decodeURIComponent(req.headers['x-groompro-offline']));
    assert.equal(metadata.employeeId, scope.employeeId);
    if (receipts.has(metadata.id)) return reply(receipts.get(metadata.id));
    const data = JSON.parse(text);
    const id = 'offline-' + metadata.id;
    const updatedAt = new Date().toISOString();
    let payload;
    if (pathname === '/api/customers') {
      const customer = { ...data, id, updatedAt, active: true, pets: [], phones: [] };
      serverRecords.customers.push(customer);
      creates++;
      payload = { customer, offlineVersions: { ['customer:' + id]: updatedAt } };
    } else if (pathname === '/api/pets') {
      const owner = serverRecords.customers.find(row => row.id === data.customerId);
      assert.ok(owner, 'Pet arrived before customer');
      const petId = data.id || id;
      const current = owner.pets.findIndex(pet => pet.id === petId);
      if (current >= 0) assert.equal(metadata.version, owner.pets[current].updatedAt);
      const pet = { ...data, id: petId, active: true, updatedAt };
      if (current < 0) owner.pets.push(pet); else owner.pets[current] = pet;
      payload = { pet, offlineVersions: { ['pet:' + petId]: updatedAt } };
    } else if (pathname === '/api/pos-drafts') {
      const draft = { id, orderNumber: 1, updatedAt, payload: {} };
      serverRecords.drafts.push(draft);
      payload = { draft, offlineVersions: { ['draft:' + id]: updatedAt } };
    } else if (pathname === '/api/pos-operation') {
      const draft = serverRecords.drafts.find(row => row.id === data.draft.draftId);
      assert.equal(metadata.version, draft.updatedAt);
      const owner = serverRecords.customers.find(row => row.id === data.draft.customerId);
      assert.equal(owner.pets[0].id, data.draft.petIds[0]);
      const ticket = { ...data.draft, id: draft.id, updatedAt, locationId: scope.locationId, payments: [], pets: [{ pet: owner.pets[0] }] };
      serverRecords.tickets.push(ticket);
      payload = { ticket, offlineVersions: { ['ticket:' + ticket.id]: updatedAt } };
    } else throw Error('Unexpected mutation ' + pathname);
    receipts.set(metadata.id, payload);
    if (['/api/customers','/api/pets'].includes(pathname) && !lostReplies.has(pathname)) {
      lostReplies.add(pathname);
      return reply({ error: 'Simulated lost acknowledgement' }, 503);
    }
    return reply(payload);
  } catch (error) { return reply({ error: error.message }, 409); }
});

async function main() {
  const chrome = process.env.GROOMPRO_TEST_CHROME;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let instance;
  let timer;
  try {
    const message = await new Promise((resolve, reject) => {
      result = resolve;
      timer = setTimeout(() => reject(Error('Browser verification timed out.')), 30000);
      if (chrome) {
        const profile = mkdtempSync(path.join(tmpdir(), 'groompro-offline-test-'));
        instance = spawn(chrome, ['--headless', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--no-default-browser-check',
          '--user-data-dir=' + profile, origin + '/'], { windowsHide: true, stdio: 'ignore' });
        instance.on('error', reject);
        instance.on('exit', code => reject(Error('Browser exited: ' + code)));
      } else {
        const storage = new Map();
        const session = new Map();
        const loadApp = () => {
          const location = { origin, reload: () => queueMicrotask(loadApp) };
          const device = {
            deviceRead: async key => structuredClone(storage.get(key)),
            deviceUpdate: async (key, update) => {
              const value = update(structuredClone(storage.get(key)));
              if (value === undefined) storage.delete(key);
              else storage.set(key, structuredClone(value));
              return structuredClone(value);
            },
          };
          vm.runInNewContext(loader + "\nObject.assign(require('offline-device-store'), device);\n" + browser, {
            device, location, window: Object.assign(new EventTarget(), { location }), navigator: { storage: {} },
            sessionStorage: { getItem: key => session.get(key), setItem: (key, value) => session.set(key, value) },
            Response, Headers, Event, CustomEvent, URL, URLSearchParams, crypto, structuredClone,
            fetch: (url, init) => fetch(new URL(url, origin), init),
          });
        };
        loadApp();
      }
    });
    assert.equal(message, 'passed');
    assert.equal(creates, 1);
    assert.equal(serverRecords.tickets.length, 1);
    assert.equal(serverRecords.customers[0].pets.length, 1);
    assert.equal(serverRecords.customers[0].pets[0].name, 'Fluffy Updated');
    console.log('Offline customer, pet, and appointment survived ' + (chrome ? 'browser reload' : 'a simulated reload') + ' and synced exactly once after an interrupted acknowledgement.');
  } finally {
    clearTimeout(timer);
    instance?.kill();
    server.closeAllConnections();
    server.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
