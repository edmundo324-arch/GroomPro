const test=require('node:test'),assert=require('node:assert/strict');require('./load-ts.cjs');
const {portalPolicy,defaultPortalPolicy}=require('../src/lib/cancellation-policy.ts'),{onlineStartAllowed}=require('../src/lib/online-booking-time.ts');
const now=new Date('2030-01-07T12:00:00Z');
test('older settings retain same-day access and 30-minute starts',()=>{
 const {minimumLeadHours,slotIntervalMinutes,...legacy}=defaultPortalPolicy,p=portalPolicy(legacy);
 assert.equal(p.minimumLeadHours,0);assert.equal(p.slotIntervalMinutes,30);
 assert.equal(onlineStartAllowed(new Date('2030-01-07T12:30:00Z'),'UTC',p,now),true);
 assert.equal(onlineStartAllowed(now,'UTC',p,now),false);
});
test('lead time, local spacing and advance boundary apply together',()=>{
 const p=portalPolicy({...defaultPortalPolicy,minimumLeadHours:24,slotIntervalMinutes:15,advanceDays:2});
 assert.equal(onlineStartAllowed(new Date('2030-01-08T11:45:00Z'),'America/Chicago',p,now),false);
 assert.equal(onlineStartAllowed(new Date('2030-01-08T12:00:00Z'),'America/Chicago',p,now),true);
 assert.equal(onlineStartAllowed(new Date('2030-01-08T12:10:00Z'),'America/Chicago',p,now),false);
 assert.equal(onlineStartAllowed(new Date('2030-01-09T12:15:00Z'),'America/Chicago',p,now),false);
 assert.equal(onlineStartAllowed(new Date('2030-01-08T12:15:01Z'),'America/Chicago',p,now),false);
});
test('spacing follows location wall time across daylight saving and non-hour offsets',()=>{
 const p={...defaultPortalPolicy,advanceDays:730};
 assert.equal(onlineStartAllowed(new Date('2030-03-10T08:30:00Z'),'America/Chicago',p,now),true);
 assert.equal(onlineStartAllowed(new Date('2030-01-08T12:15:00Z'),'Asia/Kathmandu',p,now),true);
 assert.equal(onlineStartAllowed(new Date('2030-01-08T12:00:00Z'),'Asia/Kathmandu',p,now),false);
});
test('invalid notice and spacing cannot be saved',()=>{
 for(const minimumLeadHours of [-1,Infinity,'24'])assert.throws(()=>portalPolicy({...defaultPortalPolicy,minimumLeadHours}));
 for(const slotIntervalMinutes of [0,4,241,7.5])assert.throws(()=>portalPolicy({...defaultPortalPolicy,slotIntervalMinutes}));
});
