require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
function fixture(){
 let index=0,effects=[],args=['2026-12-01','shop',true];const cells=[],cleanups=[],listeners=new Map(),requests=[];
 const react={useState:initial=>{const i=index++;if(!(i in cells))cells[i]=initial;return[cells[i],value=>{cells[i]=typeof value==='function'?value(cells[i]):value}]},useEffect:(fn,deps)=>{const i=index++;if(!cells[i]||deps.some((v,j)=>v!==cells[i][j])){cells[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn()})}}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/use-appointment-staff.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URLSearchParams,window:{addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)},require:id=>id==='react'?react:id==='../lib/appointment-staff'?require('../src/lib/appointment-staff.ts'):{employeeFetch:url=>new Promise(resolve=>requests.push({url,resolve}))}});
 const render=(next=args)=>{args=next;index=0;const result=exports.useAppointmentStaff(...args);const pending=effects;effects=[];pending.forEach(fn=>fn());return result};
 const respond=(start,off=false,ok=true)=>{requests[start].resolve({ok,json:async()=>({schedules:[{userId:'anton',locationId:'shop',dayOfWeek:2,startTime:'08:30',endTime:'17:00',active:true}]})});requests[start+1].resolve({ok,json:async()=>ok?{overrides:off?[{resourceKind:'employee',resourceId:'anton',date:'2026-12-01',locationId:'shop',dayOff:true,startTime:null,endTime:null}]:[]}:{error:'Schedules unavailable'}})};
 return {render,requests,respond,event:(name,url)=>listeners.get(name)?.({detail:{url}})};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('an open POS reloads choices when weekly or date schedules change and retry recovers failures',async()=>{
 const f=fixture();assert.equal(f.render().ready,false);f.respond(0);await flush();assert.deepEqual([...f.render().ids],['anton']);
 f.event('groompro:data-changed','/api/schedule-overrides');f.render();assert.equal(f.render().ready,false);f.respond(2,true);await flush();assert.deepEqual([...f.render().ids],[]);
 f.event('groompro:data-changed','/api/employee-schedules');f.render();f.respond(4,false,false);await flush();let state=f.render();assert.equal(state.ready,false);assert.equal(state.error,'Schedules unavailable');assert.deepEqual([...state.ids],[]);
 state.retry();f.render();f.respond(6);await flush();assert.equal(f.render().ready,true);
});
test('date/location changes reject stale responses and never reuse the prior working list',async()=>{
 const f=fixture();f.render();assert.equal(f.render(['2026-12-02','other',true]).ready,false);f.respond(0);await flush();assert.equal(f.render().ready,false);
 f.respond(2);await flush();assert.equal(f.render().ready,true);assert.deepEqual([...f.render().ids],[]);assert.match(f.requests[3].url,/start=2026-12-02&end=2026-12-02/);
 f.event('focus');f.render();assert.equal(f.requests.length,6);
});
