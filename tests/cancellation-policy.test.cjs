const test=require('node:test'),assert=require('node:assert/strict');require('./load-ts.cjs');
const {cancellationNotice,cancellationTiming,defaultCancellationNotice}=require('../src/lib/cancellation-policy.ts');
const {appointmentStyle,presentationKey,resolvedStyle}=require('../src/lib/calendar-presentation.ts');
const start=new Date('2026-11-20T18:00:00Z');
test('factory notice is 30 hours; exactly 30 hours is on time',()=>{
 assert.deepEqual(defaultCancellationNotice,{amount:30,unit:'HOURS'});
 assert.equal(cancellationTiming(start,new Date(+start-30*3600000)).late,false);
 assert.equal(cancellationTiming(start,new Date(+start-30*3600000+1)).late,true);
});
test('days and hours represent the same elapsed notice, including fractional values',()=>{
 const at=new Date('2026-11-18T18:00:00Z');
 assert.deepEqual(cancellationTiming(start,at,{amount:1.5,unit:'DAYS'}),cancellationTiming(start,at,{amount:36,unit:'HOURS'}));
 assert.equal(cancellationTiming(start,at,{amount:100,unit:'HOURS'}).requestedAt,at.toISOString());
});
test('invalid notice and dates cannot silently cancel an appointment',()=>{
 for(const amount of [-1,NaN,Infinity,'30'])assert.throws(()=>cancellationNotice({amount,unit:'HOURS'}));
 assert.throws(()=>cancellationNotice({amount:30,unit:'WEEKS'}));
 assert.throws(()=>cancellationTiming(new Date('invalid'),new Date()));
});
test('pending cancellation keeps booking status and displays red with white text even after its scheduled time',()=>{
 const ticket={status:'CONFIRMED',scheduledStart:'2000-01-01T00:00:00Z',cancellationRequest:{state:'PENDING'},presentationServiceType:'GR'};
 assert.equal(presentationKey(ticket),'CANCELLATION_REQUESTED');
 const style=appointmentStyle(ticket);
 assert.equal(style.background,'#c00000');assert.equal(style.color,'#ffffff');assert.equal(ticket.status,'CONFIRMED');
});
test('tenant appearance choices and completed states keep precedence',()=>{
 const settings={statusStyles:{'CANCELLATION_REQUESTED|GR':{color:'#123456',textColor:'#eeeeee'}}};
 assert.equal(resolvedStyle('CANCELLATION_REQUESTED|GR',settings).textColor,'#eeeeee');
 for(const status of ['CLOSED','CANCELLED','NO_SHOW'])assert.equal(presentationKey({status,cancellationRequest:{state:'PENDING'}}),status);
 assert.equal(presentationKey({status:'CONFIRMED',cancellationRequest:{state:'WAIVED'}}),'CONFIRMED');
});

test('tenant wording inserts current details without changing the fee or timing rule',()=>{
 const {portalPolicy,defaultPortalPolicy,cancellationWarning}=require('../src/lib/cancellation-policy.ts');
 const customized=portalPolicy({...defaultPortalPolicy,warning:'{business}: {fee} will apply with less than {notice} notice.'});
 assert.equal(cancellationWarning(customized,'Grand Grooming',4500),'Grand Grooming: $45.00 will apply with less than 30 hours notice.');
 assert.deepEqual(customized.notice,defaultPortalPolicy.notice);
 assert.throws(()=>portalPolicy({...defaultPortalPolicy,warning:'{unknown}'}));
 assert.equal(defaultPortalPolicy.approval,'REVIEW');
});
