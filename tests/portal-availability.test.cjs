const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');require('./load-ts.cjs');
const operating=require('../src/lib/operating-hours.ts'),coverage=require('../src/lib/calendar-coverage.ts');
function fixture(){const date='2030-01-07',weekday=1;let busy=[],blocks=[],overrides=[];
 const employees=[{id:'on',role:'FRONT',firstName:'Online'},{id:'off',role:'GROOMER',firstName:'Offline'}];
 const client={user:{findMany:async()=>employees},tenantSetting:{findMany:async()=>[{settingKey:'EMPLOYEE_AVAILABLE_ONLINE:on',value:true}]},scheduleOverride:{findMany:async()=>overrides},$queryRaw:async(parts)=>{
  const sql=parts.join('?');if(sql.includes('FROM BookingAsset WHERE'))return [{id:'van',name:'Mobile unit',category:'Tenant selected asset'}];
  if(sql.includes('FROM EmployeeSchedule'))return employees.map(e=>({resourceId:e.id,dayOfWeek:weekday,startTime:'08:00',endTime:'17:00'}));
  if(sql.includes('FROM BookingAssetSchedule'))return [{resourceId:'van',dayOfWeek:weekday,startTime:'08:00',endTime:'17:00'}];
  return busy;
 }};
 const dependencies={'./db':{db:client},'./online-booking-resources':{employeeOnlineKey:id=>'EMPLOYEE_AVAILABLE_ONLINE:'+id},'./calendar-blocks':{calendarBlocks:async()=>blocks},'./location-hours':{locationHours:async()=>({timezone:'UTC',specialHours:[],hours:operating.defaultHours()})},'./operating-hours':operating,'./calendar-coverage':coverage,'./calendar-presentation':{},'./pos-lines':{},'./ticket-timing':{},'./workflow-settings':{},'./portal-policy-store':{}};
 const js=ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../src/lib/portal-availability.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};new Function('require','exports',js)(key=>dependencies[key],exports);
 return {date,client,available:exports.portalAvailability,blocked:v=>blocks=v,busy:v=>busy=v,overrides:v=>overrides=v};}
test('tenant online selections and their schedules determine availability',async()=>{
 const f=fixture(),a=await f.available('tenant','shop',f.date,60,'GR',f.client);
 assert.deepEqual(a.available(new Date(f.date+'T09:00:00Z')).map(r=>r.id),['on','van']);
 assert.deepEqual(a.available(new Date(f.date+'T07:00:00Z')),[]);
 assert.deepEqual(a.available(new Date(f.date+'T16:30:00Z')),[]);
});
test('blocks and existing appointments remove occupied resources without revealing other customers',async()=>{
 const f=fixture();f.blocked([{resourceKind:'asset',resourceId:'van',start:f.date+'T08:00:00Z',end:f.date+'T10:00:00Z'}]);f.busy([{scheduledStart:f.date+'T09:00:00Z',durationMin:60,userId:'on',customerId:'other'}]);
 const a=await f.available('tenant','shop',f.date,60,'GR',f.client);
 assert.deepEqual(a.available(new Date(f.date+'T09:00:00Z'),'customer'),[]);
 assert.equal(a.available(new Date(f.date+'T10:00:00Z'),'customer').length,2);
});
test('a customer cannot book a second simultaneous visit on another free resource',async()=>{
 const f=fixture();f.busy([{scheduledStart:f.date+'T09:00:00Z',durationMin:60,userId:'other',customerId:'customer'}]);
 const a=await f.available('tenant','shop',f.date,60,'GR',f.client,'customer');assert.deepEqual(a.available(new Date(f.date+'T09:00:00Z'),'customer'),[]);
});

test('a day off overrides the recurring online schedule',async()=>{
 const f=fixture();f.overrides([{resourceKind:'employee',resourceId:'on',dayOff:true}]);
 const a=await f.available('tenant','shop',f.date,60,'GR',f.client);
 assert.deepEqual(a.available(new Date(f.date+'T09:00:00Z')).map(r=>r.id),['van']);
});
test('a shortened asset shift must fit the whole appointment',async()=>{
 const f=fixture();f.overrides([{resourceKind:'asset',resourceId:'van',dayOff:false,startTime:'10:00',endTime:'11:00'}]);
 const a=await f.available('tenant','shop',f.date,60,'GR',f.client);
 assert.deepEqual(a.available(new Date(f.date+'T10:00:00Z')).map(r=>r.id),['on','van']);
 assert.deepEqual(a.available(new Date(f.date+'T10:30:00Z')).map(r=>r.id),['on']);
});
