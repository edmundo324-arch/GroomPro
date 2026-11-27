require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {appointmentDisplay,appointmentDetailValue}=require('../src/lib/appointment-display.ts');
const {buildHoverDetails}=require('../src/lib/calendar-hover-details.ts');
const ticket={id:'visit',orderNumber:590,scheduledStart:'2026-11-26T14:30:00Z',appointmentTimezone:'America/Chicago',arrivalPriority:2,status:'CHECKED_IN',checkedInAt:'2026-11-26T14:28:00Z',durationMin:90,customer:{firstName:'Lauren',lastName:'Test'},pets:[{pet:{id:'daisy',name:'Daisy',breed:'Beagle',weightLbs:24}}],lines:[{petId:'daisy',packageName:'Full Wash 39',description:'Prep',assignedUser:{firstName:'Anton',lastName:'Johnson'}},{petId:'daisy',packageName:'Full Wash 39',description:'Bath',assignedUser:{firstName:'Anton',lastName:'Johnson'}},{petId:'daisy',description:'Daycare,',quantity:1}],assignments:[{user:{firstName:'Anton',lastName:'Johnson'}}]};
test('legacy visibility is retained and configured details keep line/order/emphasis without mutating settings',()=>{
 assert.equal(appointmentDisplay({showCalendarArrivalOrder:false}).fields.some(f=>f.key==='ticket.arrivalPriority'),false);
 const settings={appointmentDisplay:{fields:[{key:'ticket.arrivalPriority',row:1,bold:true},{key:'time',row:1,bold:true},{key:'pet.name',row:0,bold:false},{key:'time',row:6,bold:false},{key:'customer.secret',row:0,bold:true}]}},before=JSON.stringify(settings);
 assert.deepEqual(appointmentDisplay(settings).fields,[{key:'pet.name',row:0,bold:false},{key:'ticket.arrivalPriority',row:1,bold:true},{key:'time',row:1,bold:true}]);assert.equal(JSON.stringify(settings),before);
 assert.ok(appointmentDisplay({appointmentDisplay:{fields:[]}}).fields.length);
});
test('details come from the appointment, use shop time and avoid repeating services and employees',()=>{
 assert.equal(appointmentDetailValue(ticket,'time'),'8:30 AM');assert.equal(appointmentDetailValue(ticket,'ticket.arrivalPriority'),'Order 2');assert.equal(appointmentDetailValue(ticket,'package'),'Full Wash 39 · Daycare,');assert.equal(appointmentDetailValue(ticket,'assignments'),'Anton Johnson');assert.equal(appointmentDetailValue(ticket,'pet.weightLbs'),'24 lb');
 assert.equal(appointmentDetailValue({...ticket,arrivalPriority:null},'ticket.arrivalPriority'),'');assert.equal(appointmentDetailValue({...ticket,scheduledStart:null},'time'),'Unscheduled');
 assert.equal(appointmentDetailValue({...ticket,pets:[...ticket.pets,{pet:{id:'rex',name:'Rex',weightLbs:35}}]},'pet.weightLbs'),'Daisy: 24 lb · Rex: 35 lb');
});
test('selected hover daycare detail agrees with the POS line-item summary',()=>{
 assert.equal(buildHoverDetails({...ticket,daycareStatus:'NONE'},['ticket.daycareStatus'])[0].value,'Added');
 assert.equal(buildHoverDetails({...ticket,daycareStatus:'NONE',lines:[]},['ticket.daycareStatus'])[0].value,'Not added');
});
