require('./load-ts.cjs');const test=require('node:test'),assert=require('node:assert/strict');
const {membershipEnrollment}=require('../src/lib/report-membership-enrollment.ts');
const {reportRows}=require('../src/lib/report-export.ts');
const start=new Date('2026-11-01T05:00:00Z'),end=new Date('2026-12-01T06:00:00Z'),asOf=new Date('2026-11-19T18:00:00Z');
test('enrollment groups keep requests separate from completed changes and deduplicate memberships',()=>{
 const base={id:'a',name:'GR VIP',startedAt:'2026-11-01T05:00:00Z',status:'ACTIVE'};
 const result=membershipEnrollment([base,base,{...base,id:'b',status:'CANCELLATION_REQUESTED'},{...base,id:'c',status:'PAUSE_REQUESTED'},{...base,id:'d',status:'PAUSED'},{...base,id:'e',endedAt:'2026-11-10T00:00:00Z'},{...base,id:'f',status:'LEGACY'},{...base,id:'g',startedAt:'2026-11-30T00:00:00Z'},{...base,id:'h',startedAt:null}],start,end,asOf,'America/Chicago');
 assert.deepEqual(result.rows,[{month:'2026-11',name:'GR VIP',enrolled:6,active:1,cancelRequested:1,pauseRequested:1,paused:1,ended:1,other:1}]);assert.equal(result.invalidRecords,1);
});
test('start-month grouping uses shop timezone and export preserves the same snapshot',()=>{
 const result=membershipEnrollment([{id:'a',name:'GR VIP',startedAt:'2026-11-01T04:30:00Z',status:'ACTIVE'}],new Date('2026-10-01T05:00:00Z'),end,asOf,'America/Chicago');assert.equal(result.rows[0].month,'2026-10');
 const rows=reportRows({membershipEnrollment:result},'Shop');assert.ok(rows.some(row=>row[0]==='VIP membership enrollment'&&row[1]==='2026-10'&&row[3]===1));assert.ok(rows.some(row=>String(row[1]).includes('Not a reconstruction')));
});
