require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
// Test authorization/retry behavior independently of the device cache.
require.cache[require.resolve('../src/lib/offline-device.ts')]={exports:{deviceFetch:(...args)=>fetch(...args)}};
const {employeeFetch}=require('../src/lib/employee-fetch.ts');
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
test('agreement PIN rejection opens authorization and resumes the same read',async()=>{
 let calls=0,prompts=0;
 global.window={dispatchEvent:e=>{if(e.type==='groompro:request-pin'){prompts++;assert.equal(e.detail.mode,'SIGN_IN');e.detail.complete({});}return true;}};
 global.fetch=async()=>++calls===1?json({error:'Enter your employee PIN.'},401):json({config:{shopEmail:'shop@example.test'}});
 const response=await employeeFetch('/api/customer-agreement/staff');assert.equal(response.status,200);assert.equal(prompts,1);assert.equal(calls,2);
});
test('cancelled PIN preserves the operation and does not retry it',async()=>{
 let calls=0;global.window={dispatchEvent:e=>{if(e.type==='groompro:request-pin')e.detail.complete(false);return true;}};global.fetch=async()=>{calls++;return json({error:'Enter your employee PIN.'},401)};
 await assert.rejects(employeeFetch('/api/customer-agreement/staff'),/cancelled.*preserved/);assert.equal(calls,1);
});
