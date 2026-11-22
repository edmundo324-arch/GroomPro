require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {assignmentApproval}=require('../src/lib/calendar-assignment-approval.ts');
const {calendarAssignmentPlans,calendarApprovalSignature}=require('../src/lib/calendar-assignment-recovery.ts');
const {plannedCalendarCard,validatePlannedPackages}=require('../src/lib/planned-package-rules.ts');
const ticket={id:'ticket',locationId:'shop',scheduledStart:'2026-12-31T22:30:00.000Z',timingMode:'CONCURRENT',durationMin:100,
 pets:[{pet:{id:'dog'}}],lines:[{id:'line',petId:'dog',lineType:'SERVICE',role:'GROOM',durationMin:100,quantity:1}],assignments:[]};
const plan={petId:'dog',userId:'groomer'};
function cards(t,plans){const value={...t,plannedAssignments:calendarAssignmentPlans('tenant',t,plans,new Set())};return {employee:plannedCalendarCard(value,'groomer',new Set(['groomer']),()=>false),unassigned:plannedCalendarCard(value,'unassigned',new Set(['groomer']),()=>false)};}
test('approved late finish stays under its employee; ordinary unavailable plans stay Unassigned',()=>{
 const before=JSON.stringify(ticket),approved={...plan,availabilityApproval:assignmentApproval(ticket,'dog','groomer')};
 assert.ok(cards(ticket,[approved]).employee);assert.equal(cards(ticket,[approved]).unassigned,null);
 assert.equal(cards(ticket,[plan]).employee,null);assert.ok(cards(ticket,[plan]).unassigned);
 assert.equal(JSON.stringify(ticket),before);
});
test('approval does not follow another time, employee, location, or changed service duration',()=>{
 const approved={...plan,availabilityApproval:assignmentApproval(ticket,'dog','groomer')};
 for(const t of [{...ticket,scheduledStart:'2027-01-01T22:30:00.000Z'},{...ticket,locationId:'other'},{...ticket,lines:[{...ticket.lines[0],durationMin:120}]}])assert.equal(cards(t,[approved]).employee,null);
 assert.equal(calendarAssignmentPlans('tenant',ticket,[{...approved,userId:'bather'}],new Set())[0].calendarAvailabilityApproved,false);
});
test('historical recovery is bound to tenant, ticket, dog, employee, time and location',()=>{
 const allowed=new Set([calendarApprovalSignature('tenant',ticket,plan)]);
 assert.equal(calendarAssignmentPlans('tenant',ticket,[plan],allowed)[0].calendarAvailabilityApproved,true);
 for(const [tenant,t,p] of [['other',ticket,plan],['tenant',{...ticket,id:'other'},plan],['tenant',{...ticket,locationId:'other'},plan],['tenant',{...ticket,scheduledStart:'2027-01-01T22:30Z'},plan],['tenant',ticket,{...plan,petId:'other'}],['tenant',ticket,{...plan,userId:'other'}]])assert.equal(calendarAssignmentPlans(tenant,t,[p],allowed)[0].calendarAvailabilityApproved,false);
});
test('client-supplied approval fields are stripped; actual employees and active employee visibility retain precedence',()=>{
 const forged={...plan,calendarAvailabilityApproved:true,availabilityApproval:assignmentApproval(ticket,'dog','groomer')};
 assert.deepEqual(validatePlannedPackages([forged],['dog'],ticket.lines,false),[plan]);
 const t={...ticket,plannedAssignments:[forged]};assert.equal(plannedCalendarCard(t,'groomer',new Set(),()=>false),null);
 const actual={...t,lines:[{...ticket.lines[0],assignedUserId:'actual'}]};
 assert.equal(plannedCalendarCard(actual,'groomer',new Set(['groomer','actual']),()=>false),null);
 assert.ok(plannedCalendarCard(actual,'actual',new Set(['groomer','actual']),()=>false));
});
test('package-specific approval does not excuse another unapproved package',()=>{
 const t={...ticket,lines:[{...ticket.lines[0],packageId:'package',packageGroupKey:'one'},{...ticket.lines[0],id:'two',packageId:'package',packageGroupKey:'two'}],plannedAssignments:[{...plan,packageKey:'dog:one',calendarAvailabilityApproved:true},{...plan,packageKey:'dog:two'}]};
 const card=plannedCalendarCard(t,'groomer',new Set(['groomer']),()=>false);
 assert.equal(card.lines.length,1);assert.equal(card.lines[0].packageGroupKey,'one');
});
