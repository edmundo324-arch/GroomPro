require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {closePickupReminders,pickupRemindersHidden}=require('../src/lib/pickup-reminder-display.ts');
test('only a new completion reopens event-only reminders, including a new completion on the same ticket',()=>{
 const a={ticketId:'a',readyAt:'09:00'},b={ticketId:'b',readyAt:'09:30'};
 const closed=JSON.parse(JSON.stringify(closePickupReminders(0,[a,b],0)));
 assert.equal(pickupRemindersHidden(closed,[a],86400000),true);
 assert.equal(pickupRemindersHidden(closed,[{...a,readyAt:'10:00'}],60000),false);
 assert.equal(pickupRemindersHidden(null,[a],60000),false);
 const timed=closePickupReminders(5,[a],0);
 assert.equal(pickupRemindersHidden(timed,[a],299999),true);
 assert.equal(pickupRemindersHidden(timed,[a],300000),false);
});
