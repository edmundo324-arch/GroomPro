const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');require('./load-ts.cjs');
const operating=require('../src/lib/operating-hours.ts'),coverage=require('../src/lib/calendar-coverage.ts');
function fixture(){const date='2030-01-07',weekday=1;let busy=[],blocks=[],overrides=[];
 const employees=[{id:'on',role:'FRONT',firstName:'Online'},{id:'off',role:'GROOMER',firstName:'Offline'}];
 const client={location:{findMany:async()=>[{id:'shop'}]},user:{findMany:async()=>employees},tenantSetting:{findMany:async()=>[{settingKey:'EMPLOYEE_AVAILABLE_ONLINE:on',value:true}]},scheduleOverride:{findMany:async()=>overrides},$queryRaw:async(parts)=>{
  const sql=parts.join('?');if(sql.includes('FROM BookingAsset WHERE'))return [{id:'van',name:'Mobile unit',category:'Tenant selected asset'}];
  if(sql.includes('FROM EmployeeSchedule'))return employees.map(e=>({id:'shift-'+e.id,resourceId:e.id,dayOfWeek:weekday,startTime:'08:00',endTime:'17:00'}));
  if(sql.includes('FROM BookingAssetSchedule'))return [{resourceId:'van',dayOfWeek:weekday,startTime:'08:00',endTime:'17:00'}];
  return busy;
 }};
 const dependencies={'./employee-shift-location':require('../src/lib/employee-shift-location.ts'),'./online-booking-classes':{onlineClassKey:(kind,id)=>'ONLINE_BOOKING_CLASSES:'+kind+':'+id,acceptsOnlineClasses:(resource,requirements)=>resource===null||requirements.every(r=>!r.length||r.some(id=>resource.includes(id)))},'./db':{db:client},'./online-booking-resources':{employeeOnlineKey:id=>'EMPLOYEE_AVAILABLE_ONLINE:'+id},'./calendar-blocks':{calendarBlocks:async()=>blocks},'./location-hours':{locationHours:async(tenantId,locationId,connection)=>{assert.equal(tenantId,'tenant');assert.equal(locationId,'shop');assert.equal(connection,client);return {timezone:'UTC',specialHours:[],hours:operating.defaultHours()}}},'./operating-hours':operating,'./calendar-coverage':coverage,'./calendar-presentation':{},'./pos-lines':{},'./ticket-timing':{},'./workflow-settings':{},'./portal-policy-store':{}};
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

test('factory employee opt-out leaves only online assets and tenant opt-in adds employees',async()=>{const f=fixture();f.client.tenantSetting.findMany=async()=>[];let a=await f.available('tenant','shop',f.date,60,'GR',f.client);assert.deepEqual(a.available(new Date(f.date+'T09:00:00Z')).map(r=>r.id),['van']);f.client.tenantSetting.findMany=async()=>[{settingKey:'EMPLOYEE_AVAILABLE_ONLINE:off',value:true}];a=await f.available('tenant','shop',f.date,60,'GR',f.client);assert.deepEqual(a.available(new Date(f.date+'T09:00:00Z')).map(r=>r.id),['off','van']);});

test('class matching removes an online resource that cannot provide all selected service classes',async()=>{const f=fixture();f.client.tenantSetting.findMany=async({where})=>where.OR?[]:where.settingKey.startsWith?[{settingKey:'EMPLOYEE_AVAILABLE_ONLINE:on',value:true}]:[{settingKey:'ONLINE_BOOKING_CLASSES:employee:on',value:{classIds:['class-1']}},{settingKey:'ONLINE_BOOKING_CLASSES:asset:van',value:{classIds:['class-0']}}];const a=await f.available('tenant','shop',f.date,60,'GR',f.client,'customer',[['class-0']]);assert.deepEqual(a.available(new Date(f.date+'T09:00:00Z')).map(r=>r.id),['van']);});

test('multi-shop online hours require a resolved shop and explicit shift shop overrides employee home',async()=>{
 const f=fixture();f.client.location.findMany=async()=>[{id:'shop'},{id:'other'}];
 const employees=await f.client.user.findMany();
 const at=async()=> (await f.available('tenant','shop',f.date,60,'GR',f.client)).available(new Date(f.date+'T09:00:00Z')).map(r=>r.id);
 assert.deepEqual(await at(),['van']);
 employees[0].locationId='shop';assert.deepEqual(await at(),['on','van']);
 f.client.tenantSetting.findMany=async()=>[{settingKey:'EMPLOYEE_AVAILABLE_ONLINE:on',value:true},{settingKey:'EMPLOYEE_SHIFT_LOCATION:shift-on',value:{locationId:'other'}}];
 assert.deepEqual(await at(),['van']);
 f.client.tenantSetting.findMany=async()=>[{settingKey:'EMPLOYEE_AVAILABLE_ONLINE:on',value:true},{settingKey:'EMPLOYEE_DATE_LOCATION:on:'+f.date,value:{locationId:'other'}}];
 f.overrides([{resourceKind:'employee',resourceId:'on',dayOff:false,startTime:'08:00',endTime:'17:00'}]);
 assert.deepEqual(await at(),['van']);
});

test('an already-booked employee is unavailable across shops without exposing the other booking',async()=>{
 const f=fixture();let query='';const raw=f.client.$queryRaw;f.client.$queryRaw=async(parts,...args)=>{const sql=parts.join('?');if(sql.includes('FROM Ticket t'))query=sql;return raw(parts,...args)};
 f.busy([{locationId:'other',scheduledStart:f.date+'T09:00:00Z',durationMin:60,userId:'on',customerId:'private-other-customer'}]);
 const a=await f.available('tenant','shop',f.date,60,'GR',f.client,'customer');assert.deepEqual(a.available(new Date(f.date+'T09:00:00Z'),'customer').map(r=>r.id),['van']);assert.match(query,/OR a.userId IS NOT NULL OR l.assignedUserId IS NOT NULL/);
 assert.equal(JSON.stringify(a.available(new Date(f.date+'T09:00:00Z'),'customer')).includes('private-other-customer'),false);
});
