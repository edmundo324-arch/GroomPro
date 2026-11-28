require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
test('one busy calendar day reads each schedule dataset once and still flags a day off',async()=>{
 const reads=[],removed=[];
 const start=new Date(Date.now()+86400000);start.setUTCHours(16,0,0,0);
 const tickets=Array.from({length:40},(_,index)=>({
  id:String(index),locationId:'shop',customerId:'family'+index,scheduledStart:start,durationMin:45,
  assignments:[],lines:[{assignedUserId:index===39?'off':'working'}]
 }));
 const read=(key,data)=>async()=>{reads.push(key);return data};
 const db={ticket:{findMany:read('tickets',tickets)},user:{findMany:read('users',['off','working'].map(id=>({id,locationId:'shop'})))},
  $queryRaw:read('shifts',[{id:'shift',userId:'working',dayOfWeek:start.getUTCDay(),startTime:'08:00',endTime:'18:00'}]),
  scheduleOverride:{findMany:read('overrides',[{resourceId:'off',date:start.toISOString().slice(0,10),dayOff:true}])},
  $transaction:async fn=>fn({ticketAssignment:{deleteMany:async()=>({count:0})},ticketLine:{updateMany:async q=>{removed.push(q.where.ticketId);return {count:1}}},auditEntry:{create:async()=>{}}})};
 const deps={'./db':{db},'./operating-hours':require('../src/lib/operating-hours.ts'),
  './employee-shift-location':{employeeLocationContext:read('locations',{locations:[{id:'shop',timezone:'UTC'}],date:()=>null,shift:()=>null})}};
 const api={};new Function('require','exports',ts.transpileModule(fs.readFileSync('src/lib/groomer-assignment.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>deps[id]||{},api);
 await api.reconcileEmployeeAssignments('business',{locationId:'shop'});
 assert.deepEqual(removed,['39']);assert.deepEqual(reads.sort(),['locations','overrides','shifts','tickets','users']);
});
