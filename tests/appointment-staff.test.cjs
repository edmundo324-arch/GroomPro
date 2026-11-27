require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {scheduledEmployeeIds,plannedEmployeeChoices}=require('../src/lib/appointment-staff.ts');
const shift=(userId,dayOfWeek=2,locationId='shop')=>({userId,dayOfWeek,locationId,startTime:'08:30',endTime:'17:00',active:true});
const override=(resourceId,dayOff=false,locationId='shop')=>({resourceId,resourceKind:'employee',date:'2026-12-01',dayOff,locationId,startTime:dayOff?null:'09:00',endTime:dayOff?null:'15:00'});
test('appointment weekday determines working staff without restricting overlapping or late finishing appointments',()=>{
 assert.deepEqual(scheduledEmployeeIds('2026-12-01','shop',[shift('tuesday'),shift('monday',1),{...shift('inactive'),active:false}],[]),['tuesday']);
 assert.deepEqual(scheduledEmployeeIds('2026-11-30','shop',[shift('tuesday'),shift('monday',1)],[]),['monday']);
});
test('date-specific off/sick days override recurring shifts and added shifts can make an off weekday available',()=>{
 assert.deepEqual(scheduledEmployeeIds('2026-12-01','shop',[shift('off'),shift('working')],[override('off',true),override('cover')]),['working','cover']);
});
test('shift and override locations match the appointment shop, including staff working at a different location that date',()=>{
 const shifts=[shift('home'),shift('away',2,'other'),shift('move'),shift('incoming',2,'other')];
 assert.deepEqual(scheduledEmployeeIds('2026-12-01','shop',shifts,[override('move',false,'other'),override('incoming')]),['home','incoming']);
 assert.deepEqual(scheduledEmployeeIds('2026-12-01','',shifts,[]),[]);
 assert.deepEqual(scheduledEmployeeIds('2026-12-01','shop',[shift('unknown',2,null),shift('overrideUnknown')],[override('overrideUnknown',false,null)]),[]);
});
test('saved planned staff are retained even when off or inactive; no new off-day employee is offered',()=>{
 const employees=[{id:'working',active:true},{id:'off',active:true},{id:'inactive',active:false}];
 assert.deepEqual(plannedEmployeeChoices(employees,['working'],'off').map(e=>e.id),['working','off']);
 assert.deepEqual(plannedEmployeeChoices(employees,['working'],'inactive').map(e=>e.id),['working','inactive']);
 assert.deepEqual(plannedEmployeeChoices(employees,[],'off').map(e=>e.id),['off']);
 assert.deepEqual(plannedEmployeeChoices(employees,['working'],'').map(e=>e.id),['working']);
});
