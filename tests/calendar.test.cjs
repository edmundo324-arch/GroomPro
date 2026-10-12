const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
function load(file,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,...globals});return exports}
const {appointmentLayout}=load('src/lib/calendar-layout.ts');
test('overlapping cards use separate lanes, touching appointments reuse a lane',()=>{const day=new Date(2026,8,17);const at=(h,m=0)=>new Date(2026,8,17,h,m).toISOString();const result=appointmentLayout([{id:'a',scheduledStart:at(9),durationMin:60},{id:'b',scheduledStart:at(9,30),durationMin:60},{id:'c',scheduledStart:at(10,30),durationMin:30}],day);assert.equal(result[0].lane,0);assert.equal(result[1].lane,1);assert.equal(result[0].lanes,2);assert.equal(result[2].lanes,1);assert.equal(result[2].start,630)});
test('midnight and cross-day appointments have valid clipped positions',()=>{const result=appointmentLayout([{id:'a',scheduledStart:new Date(2026,8,16,23,30).toISOString(),durationMin:90},{id:'b',scheduledStart:new Date(2026,8,18,0).toISOString(),durationMin:30}],new Date(2026,8,17));assert.equal(result.length,1);assert.equal(result[0].start,0);assert.equal(result[0].end,60)});
function client(responses,approve){let calls=0,prompts=0;const requests=[],events=[];const {employeeFetch}=load('src/lib/employee-fetch.ts',{Headers,Request,URL,TextEncoder,crypto:require('node:crypto').webcrypto,require:()=>load('src/lib/request-fingerprint.ts',{URL}),fetch:async(url,init)=>{requests.push({url,init});const r=responses[calls++];if(r instanceof Error)throw r;return r},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail}},window:{location:{origin:'http://localhost'},dispatchEvent:e=>{if(e.type!=='groompro:request-pin')return;prompts++;events.push(e.detail);e.detail.complete(approve)}}});return{employeeFetch,requests,events,counts:()=>({calls,prompts})}}
const response=(status,error)=>new Response(JSON.stringify({error}),{status});
test('PIN rejection opens prompt then retries the original action once',async()=>{const c=client([response(401,'Employee PIN is required before changing an appointment.'),response(200)],true);assert.equal((await c.employeeFetch('/api/tickets',{method:'PATCH',body:'original'})).status,200);assert.deepEqual(c.counts(),{calls:2,prompts:1})});
test('cancelling PIN does not submit action',async()=>{const c=client([response(401,'Employee PIN is required.')],false);await assert.rejects(c.employeeFetch('/api/tickets',{method:'POST'}),/cancelled/);assert.deepEqual(c.counts(),{calls:1,prompts:1})});
test('context errors, payment failures and network errors never cause automatic retry',async()=>{for(const r of [response(401,'Tenant context is required.'),response(500,'Payment failed'),new Error('network')]){const c=client([r],true);try{await c.employeeFetch('/api/tickets/checkout',{method:'POST'})}catch{}assert.deepEqual(c.counts(),{calls:1,prompts:0})}});


test('manager approval resumes exact request with a one-time token, without switching employees',async()=>{
 const c=client([response(403,'Manager access required.'),new Response(JSON.stringify({employee:{id:'staff'}})),response(200)],{approval:'one-time'});
 const body=JSON.stringify({customerId:'c',amountCents:25});
 assert.equal((await c.employeeFetch('/api/customers/account',{method:'POST',headers:{'Content-Type':'application/json'},body})).status,200);
 assert.equal(c.events[0].mode,'APPROVAL');
 assert.equal(c.events[0].requestHash,require('node:crypto').createHash('sha256').update('POST\n/api/customers/account\n'+body).digest('hex'));
 assert.equal(c.requests[2].init.body,body);assert.equal(c.requests[2].init.headers.get('x-groompro-approval'),'one-time');
 assert.ok(!c.requests.some(r=>r.init?.method==='DELETE'));
});
test('expired session behind a manager-only endpoint asks for employee sign-in first',async()=>{
 const c=client([response(403,'Manager access required.'),new Response(JSON.stringify({employee:null})),response(200)],{});
 await c.employeeFetch('/api/restricted',{method:'PUT',body:'{}'});assert.equal(c.events[0].mode,'SIGN_IN');
});
test('protected viewing also opens PIN and cancellation leaves the request rejected',async()=>{
 const c=client([response(401,'Employee PIN is required.')],false);await assert.rejects(c.employeeFetch('/api/protected'),/cancelled/);assert.equal(c.requests.length,1);
});
