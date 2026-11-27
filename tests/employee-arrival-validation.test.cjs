const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
require('./load-ts.cjs');
const warning=require('../src/lib/scheduling-warning.ts');
function guard(message){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/employee-arrival-validation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>id==='./scheduling-warning'?warning:{ticketArrivalLimitError:async(client,tenant,ticket)=>{assert.equal(client,'tx');assert.equal(tenant,'business');assert.equal(ticket,'ticket');return message}}});
 return approve=>exports.enforceTicketArrivalLimit('tx','business','ticket',approve);
}
test('full arrival intervals reject a new planning save unless this exact warning is authorized',async()=>{
 const message='Employee arrival limit reached: This employee allows 2 family appointments every 30 minutes.';
 await assert.rejects(guard(message)(),error=>error.schedulingWarning===message);
 await assert.rejects(guard(message)(async()=>false),/arrival limit reached/);
 await guard(message)(async seen=>{assert.equal(seen,message);return true});
 const request={headers:{get:()=>encodeURIComponent(JSON.stringify(['Choose an available groomer or Assign later.']))}};
 assert.equal(warning.schedulingApproved(request,message),false);
 request.headers.get=()=>encodeURIComponent(JSON.stringify([message]));
 assert.equal(warning.schedulingApproved(request,message),true);
});
test('available arrivals need no override and other-location conflicts remain hard errors',async()=>{
 await guard(null)(async()=>{throw Error('No approval should be requested')});
 const message='This employee has an overlapping appointment at another location. Choose another time or employee.';
 await assert.rejects(guard(message)(),error=>!error.schedulingWarning&&error.message===message);
 assert.equal(warning.schedulingApproved({headers:{get:()=>encodeURIComponent(JSON.stringify([message]))}},message),false);
});
