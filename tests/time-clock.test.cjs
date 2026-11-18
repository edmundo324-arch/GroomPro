const test=require('node:test'),assert=require('node:assert/strict');require('./load-ts.cjs');
const {emptyClock,applyClock,clockTotals}=require('../src/lib/time-clock.ts');
const at=h=>'2026-11-18T'+h+':00.000Z';
const action=(state,type,time,id='shift')=>applyClock(state,{action:type,revision:state.revision},at(time),id,'shop');
test('clock-in, breaks and clock-out record elapsed time without inventing pay rules',()=>{
 let s=action(emptyClock(),'IN','08:00');s=action(s,'BREAK_START','10:00');s=action(s,'BREAK_END','10:15');s=action(s,'OUT','12:00');
 assert.deepEqual(clockTotals(s.shifts[0]),{elapsedMinutes:240,breakMinutes:15,minutesExcludingBreaks:225});assert.equal(s.revision,4);
});
test('duplicate clock-in and stale device revisions cannot add another shift',()=>{
 const s=action(emptyClock(),'IN','08:00');assert.throws(()=>action(s,'IN','08:01'),/already clocked/);
 assert.throws(()=>applyClock(s,{action:'IN',revision:0},at('08:00'),'another','shop'),/record changed/);assert.equal(s.shifts.length,1);
});
test('clocking out during a break closes the break and records offline involvement',()=>{
 let s=action(emptyClock(),'IN','08:00');s=action(s,'BREAK_START','10:00');s=applyClock(s,{action:'OUT',revision:s.revision},at('10:30'),'id','shop',true);
 assert.equal(s.shifts[0].breaks[0].end,at('10:30'));assert.equal(s.shifts[0].recordedOffline,true);assert.equal(clockTotals(s.shifts[0]).breakMinutes,30);
});
test('corrections require a reason and cannot overlap shifts or move work into the future',()=>{
 let s=action(emptyClock(),'IN','08:00');s=action(s,'OUT','09:00');s=action(s,'IN','10:00','second');s=action(s,'OUT','11:00');
 const correction={action:'CORRECT',revision:s.revision,shiftId:'shift',start:at('08:00'),end:at('10:30'),breaks:[],reason:'Correct entry'};
 assert.throws(()=>applyClock(s,correction,at('12:00'),'id','shop'),/overlaps/);
 assert.throws(()=>applyClock(s,{...correction,end:at('09:30'),reason:''},at('12:00'),'id','shop'),/reason/);
 assert.throws(()=>applyClock(s,{...correction,start:at('13:00'),end:at('14:00')},at('12:00'),'id','shop'),/future/);
 const fixed=applyClock(s,{...correction,end:at('09:30')},at('12:00'),'id','shop');assert.equal(fixed.shifts[0].end,at('09:30'));assert.equal(s.shifts[0].end,at('09:00'));
});
test('break boundaries remain inside the recorded shift',()=>{
 let s=action(emptyClock(),'IN','08:00');s=action(s,'OUT','10:00');
 assert.throws(()=>applyClock(s,{action:'CORRECT',revision:s.revision,shiftId:'shift',start:at('08:00'),end:at('10:00'),breaks:[{start:at('09:30'),end:at('10:30')}],reason:'Check'},at('12:00'),'id','shop'),/beyond/);
});
