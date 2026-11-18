const test=require('node:test'),assert=require('node:assert/strict');require('./load-ts.cjs');
const {projectOffline,offlineReadRecords}=require('../src/lib/offline-records.ts');const {offlineAction,offlineRecordVersion}=require('../src/lib/offline-actions.ts');const {emptyClock}=require('../src/lib/time-clock.ts');
const scope={tenantId:'tenant',locationId:'shop',employeeId:'employee'};
function state(){return {scope,location:{id:'shop',timezone:'America/Chicago'},employee:{id:'employee',role:'ADMIN'},customers:[],tickets:[],notes:[],drafts:[],lookups:{'/api/catalog':{services:[],packages:[],products:[]},'/api/time-clock':{employeeId:'employee',canManage:true,clocks:{employee:emptyClock()}}}};}
function command(id,url,method,body){return {...scope,id,url,method,body:JSON.stringify(body),createdAt:Date.parse('2026-11-18T08:00:00Z')}}
test('offline services and packages use the same catalog validation and preserve their link',()=>{
 const s=state();const service=projectOffline(s,command('s','/api/catalog','POST',{kind:'services',name:'Groom',priceCents:5000,durationMin:60,active:true,workflowRole:'GROOM'})).item;
 const pkg=projectOffline(s,command('p','/api/catalog','POST',{kind:'packages',name:'Full groom',priceCents:4500,active:true,items:[{serviceId:service.id,quantity:1}]})).item;
 assert.equal(pkg.id,'offline-p');assert.equal(pkg.items[0].serviceId,'offline-s');assert.equal(pkg.items[0].role,'GROOM');assert.equal(pkg.basePriceCents,4500);
 assert.equal(offlineReadRecords(s,new URL('https://test/api/catalog')).packages[0].name,'Full groom');
 assert.throws(()=>projectOffline(s,command('bad','/api/catalog','POST',{kind:'services',name:'Bad',priceCents:-1,durationMin:60,active:true})),/Price/);
});
test('offline catalog edits preserve the cloud revision until sync and reject unprepared items',()=>{
 const s=state();s.lookups['/api/catalog'].packages.push({id:'p',name:'Original',_offlineVersion:'cloud-version',items:[]});s.lookups['/api/catalog'].services.push({id:'s',workflowRole:'GROOM'});
 const result=projectOffline(s,command('edit','/api/catalog','PATCH',{id:'p',kind:'packages',name:'Updated',priceCents:500,active:true,items:[{serviceId:'s',quantity:1}]}));assert.equal(offlineRecordVersion(result.item),'cloud-version');
 assert.throws(()=>projectOffline(s,command('edit','/api/catalog','PATCH',{id:'missing',kind:'services',name:'Name',priceCents:500,durationMin:30,active:true})),/not available/);
});
test('offline time entries advance the saved revision and keep corrections permission checked',()=>{
 const s=state(),r=projectOffline(s,command('in','/api/time-clock?locationId=shop','POST',{action:'IN',revision:0,at:'2026-11-18T08:00:00Z'}));assert.equal(r.clock.shifts.length,1);assert.equal(r.clock.revision,1);
 const out=projectOffline(s,command('out','/api/time-clock?locationId=shop','POST',{action:'OUT',revision:1,at:'2026-11-18T12:00:00Z'}));assert.equal(out.clock.shifts[0].end,'2026-11-18T12:00:00Z');
 s.lookups['/api/time-clock'].canManage=false;assert.throws(()=>projectOffline(s,command('fix','/api/time-clock?locationId=shop','POST',{action:'CORRECT',revision:2,userId:'employee'})),/manager/);
});
test('offline expansion does not enable payment or external messaging replay',()=>{
 for(const url of ['/api/tickets/payment','/api/messages','/api/catalog'])assert.equal(offlineAction(new URL('https://test'+url),'POST',{kind:'products',action:'SEND'}),null);
});

test('offline schedules edit recurring shifts and date overrides without losing the cloud revision',()=>{
 const s=state();s.lookups['/api/offline/schedules']={_offlineVersion:'original',schedules:[],assetSchedules:[],overrides:[]};
 projectOffline(s,command('shift','/api/employee-schedules','PUT',{userId:'employee',dayOfWeek:3,startTime:'08:00',endTime:'17:00'}));
 assert.equal(offlineReadRecords(s,new URL('https://test/api/employee-schedules')).schedules[0].id,'offline-shift');
 projectOffline(s,command('off','/api/schedule-overrides','PUT',{resourceKind:'employee',resourceId:'employee',date:'2026-11-18',dayOff:true,absence:'SICK'}));
 assert.equal(offlineReadRecords(s,new URL('https://test/api/schedule-overrides?start=2026-11-18&end=2026-11-18')).overrides[0].dayOff,true);
 projectOffline(s,command('reset','/api/schedule-overrides','DELETE',{resourceKind:'employee',resourceId:'employee',date:'2026-11-18'}));assert.equal(s.lookups['/api/offline/schedules'].overrides.length,0);
 assert.equal(s.lookups['/api/offline/schedules']._offlineVersion,'original');
 s.employee.role='FRONT';assert.throws(()=>projectOffline(s,command('no','/api/employee-schedules','DELETE',{userId:'employee',dayOfWeek:3})),/manager/);
});
test('saved reports never substitute another location, date range or comparison choice',()=>{
 const s=state(),query='/api/reports?locationId=shop&from=2026-11-01&through=2026-11-18&compare=false';s.lookups[query]={appointments:4,offlineSavedAt:'2026-11-18T08:00:00Z'};
 assert.equal(offlineReadRecords(s,new URL('https://test'+query)).offlineReport,true);
 assert.throws(()=>offlineReadRecords(s,new URL('https://test'+query.replace('shop','other'))),/not been saved/);
 assert.throws(()=>offlineReadRecords(s,new URL('https://test'+query.replace('false','true'))),/not been saved/);
});

test('offline customer creation rejects an existing normalized phone without making another record',()=>{
 const s=state();s.customers=[{id:'existing',phones:[{number:'(555) 555-0100'}],pets:[]}];
 assert.throws(()=>projectOffline(s,command('duplicate','/api/customers','POST',{firstName:'Different',lastName:'Spelling',phone:'5555550100'})),/already belongs/);assert.equal(s.customers.length,1);
});

test('offline calendar reflects edited schedules only for its visible resources',()=>{
 const s=state();s.since='2026-01-01T00:00:00Z';s.through='2027-01-01T00:00:00Z';s.lookups['/api/calendar']={employees:[{id:'employee'}],assets:[]};s.lookups['/api/offline/schedules']={schedules:[{userId:'employee',dayOfWeek:3,startTime:'09:00',endTime:'15:00',active:true},{userId:'outside',active:true}],assetSchedules:[],overrides:[]};
 const result=offlineReadRecords(s,new URL('https://test/api/calendar?start=2026-11-18T00:00:00Z&end=2026-11-19T00:00:00Z'));assert.equal(result.employeeSchedules.length,1);assert.equal(result.employeeSchedules[0].startTime,'09:00');
});
