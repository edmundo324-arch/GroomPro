require('./load-ts.cjs');const test=require('node:test'),assert=require('node:assert/strict');
const {calendarSelection}=require('../src/lib/pos-calendar-selection.ts');
test('calendar selection targets only the active workflow and preserves exact wall-clock time',()=>{const d=new Date(2026,10,2,11,35),r={id:'bather',kind:'employee',name:'Bather'};assert.deepEqual(calendarSelection('Rebook',d,r),{workflow:'rebook',value:'2026-11-02T11:35',employeeId:'bather',asset:null});assert.equal(calendarSelection('Items',d,r).workflow,'appointment')});
test('asset selection never becomes an employee identifier',()=>{const s=calendarSelection('Rebook',new Date(2026,10,2,9),{id:'tub',kind:'asset',name:'Full wash'});assert.equal(s.employeeId,'');assert.deepEqual(s.asset,{id:'tub',name:'Full wash'})});
