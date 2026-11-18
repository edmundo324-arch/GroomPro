const test=require('node:test'),assert=require('node:assert/strict');require('./load-ts.cjs');
const {appointmentBreakdowns}=require('../src/lib/report-appointments.ts');
const {reportCsv}=require('../src/lib/report-export.ts');
test('appointment totals retain cancellations and count shared services/employees once per ticket',()=>{
 const lines=[{serviceId:'s',service:{name:'Bath'},assignedUserId:'u'},{serviceId:'s',service:{name:'Bath'},assignedUserId:'u'},{serviceId:'g',service:{name:'Groom'},assignedUserId:'v'}];
 const result=appointmentBreakdowns([{status:'CANCELLED',scheduledStart:'2026-11-20T02:30:00Z',lines},{status:'NO_SHOW',scheduledStart:'2026-11-20T02:30:00Z',lines:[]}],[{id:'u',displayName:'Taylor'},{id:'v',displayName:'Alex'}],'America/Chicago');
 assert.equal(result.total,2);assert.deepEqual(result.days,[{id:'2026-11-19',name:'2026-11-19',count:2}]);assert.equal(result.hours[0].id,'20:00');assert.equal(result.services.find(s=>s.id==='s').count,1);assert.equal(result.employees.find(s=>s.id==='u').count,1);assert.equal(result.employees.find(s=>s.id==='unassigned').count,1);assert.equal(result.statuses.length,2);
});
test('hidden employee assignments are neither exposed nor mislabeled as Unassigned',()=>{const r=appointmentBreakdowns([{status:'OPEN',scheduledStart:'2026-11-20T15:00:00Z',lines:[{assignedUserId:'hidden'}]}],[],'UTC');assert.deepEqual(r.employees,[]);assert.equal(r.total,1)});
test('CSV preserves current and previous appointment counts from the same snapshot',()=>{const current=appointmentBreakdowns([{status:'NO_SHOW',scheduledStart:'2026-11-20T15:00:00Z',lines:[]}],[],'UTC');const csv=reportCsv({appointmentVolume:current,previous:{appointmentVolume:{...current,total:3}},start:'a',end:'b'},'Shop');assert.ok(csv.includes('"Appointment volume","All appointments","1","3"'));assert.ok(csv.includes('"Appointments — statuses","NO SHOW","1","1"'));});
