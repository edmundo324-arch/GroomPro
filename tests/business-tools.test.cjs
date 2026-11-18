const test=require('node:test');
const assert=require('node:assert/strict');
require('./load-ts.cjs');
const {validateLibrary}=require('../src/lib/business-libraries.ts');
const {reportSummary}=require('../src/lib/report-summary.ts');
const {calendarInvitation}=require('../src/lib/calendar-invitation.ts');
test('grooming quick picks retain the chosen field and reject unsupported fields',()=>{
 assert.deepEqual(validateLibrary('grooming-picks',[{id:'a',name:'Tail',field:'tail',text:' Leave long '}])[0],{id:'a',name:'Tail',field:'tail',text:'Leave long',active:true});
 assert.throws(()=>validateLibrary('grooming-picks',[{id:'a',name:'Tail',field:'customerNotes',text:'Long'}]),/grooming field/);
 assert.throws(()=>validateLibrary('grooming-picks',[{id:'a',name:'Tail',field:'tail',text:'Long'},{id:'a',name:'Ears',field:'ears',text:'Short'}]),/identifier/);
});
test('vendor product associations are deduplicated without changing supplier details',()=>{
 const [vendor]=validateLibrary('vendors',[{id:'v',name:'Supplier',phone:'555-555-0100',productIds:['p','p'],active:false}]);
 assert.deepEqual(vendor.productIds,['p']);assert.equal(vendor.phone,'555-555-0100');assert.equal(vendor.active,false);
});
test('reports keep receipts, booked line revenue, commissions and period boundaries separate',()=>{
 const start=new Date('2026-11-01T00:00:00Z'),end=new Date('2026-12-01T00:00:00Z');
 const result=reportSummary([{totalCents:9000,status:'OPEN'}],[{amount:'25.50'}],[{totalCents:10000,tipCents:1000,lines:[{lineType:'SERVICE',serviceId:'s',description:'Groom',quantity:1,totalCents:8000,assignedUserId:'u',assignedUser:{displayName:'Sam'},commissionCents:4000}]}],[{status:'ACTIVE',startedAt:start},{status:'ACTIVE',startedAt:end}],[{source:'Friend'}],start,end);
 assert.equal(result.closedSalesCents,8000);assert.equal(result.tipsCents,1000);assert.equal(result.collectedCents,2550);assert.equal(result.projectedSalesCents,9000);assert.equal(result.serviceSales[0].amountCents,8000);assert.equal(result.commissions[0].amountCents,4000);assert.equal(result.membershipStarts,1);assert.equal(result.referrals.Friend,1);
});
test('calendar invitations preserve identity and time, escape content and fold long UTF-8 lines',()=>{
 const ticket={id:'a',scheduledStart:new Date('2026-11-01T15:00:00Z'),updatedAt:new Date('2026-10-31T12:00:00Z'),durationMin:90,status:'CONFIRMED'};
 const ics=calendarInvitation(ticket,'Shop, One; Two\n'+ 'é'.repeat(100),'Main Street');
 assert.match(ics,/UID:a@groompro/);assert.match(ics,/DTSTART:20261101T150000Z/);assert.match(ics,/DTEND:20261101T163000Z/);assert.ok(ics.includes('Shop\\, One\\; Two\\n'));
 for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
 assert.match(calendarInvitation({...ticket,status:'CANCELLED'},'Shop',''),/STATUS:CANCELLED/);
 assert.throws(()=>calendarInvitation({...ticket,scheduledStart:null},'Shop',''),/Schedule/);
});
