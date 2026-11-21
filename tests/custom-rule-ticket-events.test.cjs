require('./load-ts.cjs');const test=require('node:test'),assert=require('node:assert/strict');const {ticketRuleEvent,ticketRuleEventCurrent}=require('../src/lib/custom-rule-ticket-events.ts');
const audit={id:'event',tenantId:'tenant',entityType:'TICKET',entityId:'ticket',customerId:'customer',action:'MOVE',details:{newStart:'2026-11-22T15:00:00Z'}},ticket={id:'ticket',tenantId:'tenant',customerId:'customer',status:'CONFIRMED',scheduledStart:'2026-11-22T15:00:00Z'};
test('actual recorded events identify customer confirmation, completion and cancellation without confusing shop acceptance or void',()=>{assert.equal(ticketRuleEvent(audit),'APPOINTMENT_CHANGED');assert.equal(ticketRuleEvent({...audit,action:'CUSTOMER_ATTENDANCE_CONFIRMED'}),'APPOINTMENT_CONFIRMED');assert.equal(ticketRuleEvent({...audit,action:'STATUS_CHANGE',details:{newStatus:'CONFIRMED'}}),null);assert.equal(ticketRuleEvent({...audit,action:'TICKET_VOIDED'}),null);assert.equal(ticketRuleEvent({...audit,action:'CANCELLATION_REVIEW',details:{keptAppointment:true,state:'FEE_APPLIED'}}),null)});
test('obsolete, foreign, moved-again and voided appointments cannot trigger delayed messages',()=>{assert.equal(ticketRuleEventCurrent('APPOINTMENT_CHANGED',audit,ticket,null,false,'event'),true);for(const [t,voided,latest] of [[{...ticket,tenantId:'other'},false,'event'],[{...ticket,scheduledStart:'2026-11-23T15:00:00Z'},false,'event'],[ticket,true,'event'],[ticket,false,'newer-event']])assert.equal(ticketRuleEventCurrent('APPOINTMENT_CHANGED',audit,t,null,voided,latest),false)});
test('customer attendance must still refer to the currently booked time',()=>{const a={...audit,details:{scheduledStart:ticket.scheduledStart}};assert.equal(ticketRuleEventCurrent('APPOINTMENT_CONFIRMED',a,ticket,{scheduledStart:ticket.scheduledStart,confirmedAt:'2026-11-20'},false,'event'),true);assert.equal(ticketRuleEventCurrent('APPOINTMENT_CONFIRMED',a,ticket,{scheduledStart:'2026-11-21',confirmedAt:'2026-11-20'},false,'event'),false)});

test('booking notices cover rebooking and accepted online requests, never pending requests',()=>{
 const a={...audit,action:'REBOOK',details:{scheduledStart:ticket.scheduledStart}};
 assert.equal(ticketRuleEvent(a),'APPOINTMENT_CREATED');
 for(const bookingDecision of ['REQUESTED','PENDING','REJECTED'])assert.equal(ticketRuleEventCurrent('APPOINTMENT_CREATED',a,{...ticket,bookingDecision},null,false,'event'),false);
 const accepted={...a,action:'ONLINE_BOOKING_REVIEW',details:{...a.details,decision:'ACCEPTED'}};
 assert.equal(ticketRuleEvent(accepted),'APPOINTMENT_CREATED');assert.equal(ticketRuleEventCurrent('APPOINTMENT_CREATED',accepted,{...ticket,bookingDecision:'ACCEPTED'},null,false,'event'),true);
 assert.equal(ticketRuleEvent({...accepted,details:{decision:'REJECTED'}}),'APPOINTMENT_CANCELLED');
 assert.equal(ticketRuleEvent({...accepted,details:null}),null);
});
test('a cancellation fee does not turn a cancelled appointment into a no-show',()=>{
 const cancelled={...ticket,status:'CANCELLED',noShowFeeProcessedAt:new Date()};
 assert.equal(ticketRuleEventCurrent('NO_SHOW',audit,cancelled,null,false,'event'),false);
 assert.equal(ticketRuleEventCurrent('APPOINTMENT_CANCELLED',audit,cancelled,null,false,'event'),true);
 assert.equal(ticketRuleEventCurrent('NO_SHOW',audit,{...cancelled,status:'NO_SHOW'},null,false,'event'),true);
});

test('explicit no-show fee audit preserves the established cancelled-ticket storage without guessing from a fee',()=>{
 const a={...audit,action:'NO_SHOW_FEE_TO_ACCOUNT',details:{noShowStatus:'NO_SHOW'}},t={...ticket,status:'CANCELLED',noShowFeeProcessedAt:new Date()};
 assert.equal(ticketRuleEvent(a),'NO_SHOW');assert.equal(ticketRuleEvent({...a,details:{}}),null);
 assert.equal(ticketRuleEventCurrent('NO_SHOW',a,t,null,false,'event'),true);
 assert.equal(ticketRuleEventCurrent('NO_SHOW',a,{...t,status:'OPEN'},null,false,'event'),false);
});
