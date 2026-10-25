const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
function fixture(){const calls=[],gates=[];const ctx={exports:{},require:()=>({requestMaterial:()=>''}),Headers,Request,URL,crypto:require('crypto').webcrypto,window:{dispatchEvent:()=>{}},CustomEvent:class{},fetch:(url)=>{calls.push(url);return new Promise(resolve=>gates.push(()=>resolve(new Response('{}',{status:200}))))}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/employee-fetch.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);return{fetch:ctx.exports.employeeFetch,clear:ctx.exports.clearEmployeeReads,calls,gates}}
test('Independent reads start together instead of waiting in the write queue',async()=>{const f=fixture(),a=f.fetch('/a'),b=f.fetch('/b');assert.deepEqual(f.calls,['/a','/b']);f.gates.splice(0).forEach(g=>g());await Promise.all([a,b])});
test('Identical concurrent reads share a request and receive separate consumable responses',async()=>{const f=fixture(),a=f.fetch('/a'),b=f.fetch('/a');assert.equal(f.calls.length,1);f.gates.shift()();assert.deepEqual(await (await a).json(),{});assert.deepEqual(await (await b).json(),{})});
test('A slow save does not block opening another ticket',async()=>{const f=fixture(),a=f.fetch('/save',{method:'POST'});await Promise.resolve();const b=f.fetch('/ticket');assert.deepEqual(f.calls,['/save','/ticket']);f.gates[1]();await b;f.gates[0]();await a});
test('Writes to the same record retain ordering and are submitted once',async()=>{const f=fixture(),a=f.fetch('/api/tickets',{method:'POST'}),b=f.fetch('/api/tickets',{method:'POST'});await Promise.resolve();assert.deepEqual(f.calls,['/api/tickets']);f.gates[0]();await a;await Promise.resolve();assert.deepEqual(f.calls,['/api/tickets','/api/tickets']);f.gates[1]();await b});

test('Queued writes cannot run under a different employee or business context',async()=>{const f=fixture(),first=f.fetch('/api/tickets',{method:'POST'}),second=f.fetch('/api/tickets',{method:'POST'});const rejected=assert.rejects(second,/changed/);await Promise.resolve();f.clear();f.gates[0]();await first;await rejected;assert.deepEqual(f.calls,['/api/tickets'])});

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const write=(ticketId)=>({method:'PATCH',body:JSON.stringify({ticketId})});
test('unrelated tickets and customer saves proceed while a slow ticket save is pending',async()=>{const f=fixture(),a=f.fetch('/api/tickets',write('one')),b=f.fetch('/api/tickets',write('two')),c=f.fetch('/api/customers/owner',{method:'PATCH',body:'{}'});await tick();assert.equal(f.calls.length,3);f.gates[1]();f.gates[2]();await Promise.all([b,c]);f.gates[0]();await a});
test('checkout waits for the same ticket line save while another ticket remains independent',async()=>{const f=fixture(),a=f.fetch('/api/ticket-lines',write('one')),b=f.fetch('/api/pos-operation',{method:'POST',body:JSON.stringify({ticketId:'one',kind:'PAYMENT'})}),c=f.fetch('/api/tickets',write('two'));await tick();assert.deepEqual(f.calls,['/api/ticket-lines','/api/tickets']);f.gates[1]();await c;f.gates[0]();await a;await tick();assert.equal(f.calls[2],'/api/pos-operation');f.gates[2]();await b});
test('different permanent-note and profile paths for the same pet serialize',async()=>{const f=fixture(),a=f.fetch('/api/grooming-notes',{method:'PATCH',body:JSON.stringify({permanent:'PET',entityId:'dog'})}),b=f.fetch('/api/pets',{method:'PATCH',body:JSON.stringify({id:'dog'})});await tick();assert.equal(f.calls.length,1);f.gates[0]();await a;await tick();assert.equal(f.calls.length,2);f.gates[1]();await b});

test('an uncertain payment is not retried and a failed request releases its record queue',async()=>{
 const calls=[];let rejectFirst;const ctx={exports:{},require:()=>({requestMaterial:()=>''}),Headers,Request,URL,crypto:require('crypto').webcrypto,window:{dispatchEvent:()=>{}},CustomEvent:class{},fetch:url=>{calls.push(url);return calls.length===1?new Promise((resolve,reject)=>{rejectFirst=reject}):Promise.resolve(new Response('{}',{status:200}))}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/employee-fetch.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 const first=ctx.exports.employeeFetch('/api/pos-operation',{method:'POST',body:JSON.stringify({ticketId:'one',kind:'PAYMENT'})});
 const rejected=assert.rejects(first,/network uncertain/);
 const next=ctx.exports.employeeFetch('/api/tickets',write('one'));
 await tick();assert.equal(calls.length,1);rejectFirst(Error('network uncertain'));await rejected;await next;
 assert.deepEqual(calls,['/api/pos-operation','/api/tickets']);
});
