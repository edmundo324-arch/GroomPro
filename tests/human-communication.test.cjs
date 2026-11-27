require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {helpfulError,vipConversationHint,deliveryMessage}=require('../src/lib/human-communication.ts');
const {reportCardText}=require('../src/lib/report-card.ts');
const {schedulingWarning}=require('../src/lib/scheduling-warning.ts');

test('VIP guidance uses the selected pet and location date, not another pet or UTC day',()=>{
 const now=new Date('2026-11-17T02:00:00Z');
 assert.equal(vipConversationHint({name:'Gizmo'},now,'America/Chicago'),'Check this after discussing VIP Membership for Gizmo with their owner. The conversation will be recorded for 11/16/26.');
 assert.equal(vipConversationHint({name:'Rose',careFlags:{vipConversationAt:'2026-11-10T02:00:00Z'}},now,'America/Chicago'),'VIP Membership was discussed for Rose on 11/9/26. Uncheck only if this was recorded by mistake.');
 assert.doesNotMatch(vipConversationHint({name:'Rose',careFlags:{vipConversationAt:'invalid'}},now,'America/Chicago'),/Invalid|11\/16/);
});
test('technical errors give a safe next step without claiming that a write failed',()=>{
 assert.match(helpfulError('Failed to fetch'),/check whether your change was saved/);
 assert.doesNotMatch(helpfulError('PrismaClientInitializationError: secret host'),/Prisma|secret/);
 const validation='Gizmo’s notes are too long. Shorten them before saving.';
 assert.equal(helpfulError(validation),validation);
});
test('presentation does not change PIN or scheduling override tokens',()=>{
 const warning='Nearby appointment warning: Gizmo has another visit.';
 const payload=schedulingWarning(warning);helpfulError(payload.error);
 assert.equal(payload.schedulingWarning,warning);
 assert.equal(helpfulError('Employee PIN is required.'),'Employee PIN is required.');
});
test('delivery wording distinguishes accepted, sent, delivered and unknown outcomes',()=>{
 assert.match(deliveryMessage('QUEUED'),/not been confirmed/);
 assert.match(deliveryMessage('SENT'),/not been confirmed/);
 assert.equal(deliveryMessage('DELIVERED'),'The text was delivered.');
 assert.match(deliveryMessage('UNKNOWN'),/before resending/);
 assert.doesNotMatch(deliveryMessage('FAILED'),/was delivered/);
});
test('customer report cards retain tenant-written content without inventing service completion',()=>{
 const ticket={pets:[{pet:{id:'p',name:'Gizmo'}}],lines:[{petId:'p',lineType:'SERVICE',reportCardDescription:'Our custom coat-care message',service:{description:'Fallback'}}]};
 assert.match(reportCardText(ticket),/Our custom coat-care message/);
 const empty=reportCardText({...ticket,lines:[]});
 assert.match(empty,/Gizmo’s visit/);assert.doesNotMatch(empty,/recorded|completed|ready for pickup/i);
});

test('browser and database errors give a next step without exposing internal details',()=>{
 for(const raw of ["Failed to execute 'json' on 'Response': Unexpected end of JSON input",'Unexpected token < in JSON at position 0','TypeError: b.$transaction is not a function',"Cannot read properties of undefined (reading 'id')"]){
  assert.match(helpfulError(raw),/check|Reopen/i);
  assert.doesNotMatch(helpfulError(raw),/json|transaction|undefined/i);
 }
 assert.equal(helpfulError('Gizmo’s appointment has been confirmed.'),'Gizmo’s appointment has been confirmed.');
});
