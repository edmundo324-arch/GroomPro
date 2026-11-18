const test=require('node:test'),assert=require('node:assert/strict');require('./load-ts.cjs');const {employeeReport}=require('../src/lib/employee-report.ts');
const employees=[{id:'a',firstName:'Alex',lastName:'Groomer'}],d=v=>new Date('2026-11-18T'+v+':00Z');
const run=shifts=>employeeReport(employees,[{lines:[{assignedUserId:'a',commissionCents:1234},{assignedUserId:'hidden',commissionCents:9999}]}],new Map([['a',{revision:1,shifts}]]),'shop',d('09:00'),d('17:00'),d('12:00'));
test('attendance clips shifts and breaks to report period/location; commissions stay recorded',()=>{
 const result=run([{start:d('08:00').toISOString(),end:d('11:00').toISOString(),locationId:'shop',breaks:[{start:d('08:45').toISOString(),end:d('09:15').toISOString()}]},{start:d('10:00').toISOString(),end:d('11:00').toISOString(),locationId:'other',breaks:[]}]);
 assert.deepEqual(result.rows[0],{id:'a',name:'Alex Groomer',commissionCents:1234,tipCents:0,elapsedMinutes:120,breakMinutes:15,minutesExcludingBreaks:105,openShifts:0});
});
test('open shifts stop at snapshot time and overlapping breaks are not subtracted twice',()=>{
 const result=run([{start:d('10:00').toISOString(),locationId:'shop',breaks:[{start:d('10:30').toISOString(),end:d('11:30').toISOString()},{start:d('11:00').toISOString()}]}]);
 assert.equal(result.rows[0].elapsedMinutes,120);assert.equal(result.rows[0].breakMinutes,90);assert.equal(result.rows[0].minutesExcludingBreaks,30);assert.equal(result.rows[0].openShifts,1);
});
test('invalid time data is flagged and missing/hidden employees are not exposed',()=>{
 const result=run([{start:'invalid',locationId:'shop',breaks:[]}]);assert.equal(result.invalidRecords,1);assert.equal(result.rows.length,1);assert.equal(result.rows[0].elapsedMinutes,0);
});

test('tip allocation follows original closed-ticket selection, including later tips and inactive employees',()=>{
 const report=employeeReport(employees,[{id:'ticket',tipCents:3000,lines:[]}],new Map(),'shop',d('09:00'),d('17:00'),d('12:00'),new Map([['ticket',{shares:[{userId:'a',amountCents:2000},{userId:'hidden',amountCents:500}]}],['outside-period',{shares:[{userId:'a',amountCents:9000}]}]]));
 assert.equal(report.rows[0].tipCents,2000);assert.equal(report.unallocatedTipCents,500);assert.equal(report.rows.length,1);
});
