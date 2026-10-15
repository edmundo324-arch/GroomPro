require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {buildHoverDetails,hoverValue,friendlyHoverLabel}=require('../src/lib/calendar-hover-details.ts');
test('popup keeps each dog and service value linked to its own record',()=>{
const ticket={customer:{firstName:'Owner'},pets:[{pet:{id:'a',weightLbs:8}},{pet:{id:'b',weightLbs:40}}],lines:[{id:'la',petId:'a',totalCents:8000},{id:'lb',petId:'b',totalCents:12000}]};
const d=buildHoverDetails(ticket,['customer.firstName','pet.weightLbs','line.totalCents']);assert.deepEqual(d.filter(x=>x.petId==='a').map(x=>x.value),['8 lb','$80.00']);assert.deepEqual(d.filter(x=>x.petId==='b').map(x=>x.value),['40 lb','$120.00']);assert.equal(d[0].petId,undefined);
});
test('popup uses human units, short labels and omits empty fields',()=>{assert.equal(friendlyHoverLabel('pet.weightLbs'),'Weight');assert.equal(friendlyHoverLabel('line.packageName'),'Services');assert.equal(hoverValue('customer.balanceCents',4500),'$45.00');assert.equal(hoverValue('pet.notes',null),'');});
