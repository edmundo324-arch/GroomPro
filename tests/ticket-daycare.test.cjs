require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {ticketDaycareLabel}=require('../src/lib/ticket-daycare.ts');

test('POS recognizes daycare added from Items, including imported punctuation and package services',()=>{
 const ticket={daycareStatus:'NONE',lines:[{description:'Daycare,',quantity:1,petId:'daisy',lineType:'SERVICE'}]},before=JSON.stringify(ticket);
 assert.equal(ticketDaycareLabel(ticket),'Added');
 assert.equal(JSON.stringify(ticket),before);
 assert.equal(ticketDaycareLabel({...ticket,lines:[{description:'Full Wash · Daycare',packageName:'Full Wash',quantity:1}]}),'Added');
 assert.equal(ticketDaycareLabel({...ticket,lines:[]}),'Not added');
});
test('daycare catalog and saved service metadata are recognized without requiring a current active service',()=>{
 assert.equal(ticketDaycareLabel({lines:[{serviceId:'day',description:'Extra time',quantity:1}]},[{id:'day',name:'Afternoon Stay',category:'DAYCARE',active:false}]),'Added');
 assert.equal(ticketDaycareLabel({lines:[{service:{name:'Day Care'},quantity:1}]}),'Added');
 assert.equal(ticketDaycareLabel({lines:[{service:{name:'Afternoon Stay',category:'DAYCARE'},quantity:1}]}),'Added');
 assert.equal(ticketDaycareLabel({lines:[{type:'SERVICE',id:'day',description:'Afternoon Stay',quantity:1}]},[{id:'day',name:'Afternoon Stay',category:'DAYCARE'}]),'Added');
});
test('unrelated products, descriptive mentions and removed services do not report daycare added',()=>{
 for(const line of [{description:'Daycare shampoo',quantity:1},{description:'Groom before daycare',quantity:1},{description:'Daycare',lineType:'PRODUCT',quantity:1},{description:'Daycare',type:'PRODUCT',quantity:1},{description:'Daycare',productId:'p',quantity:1},{description:'Daycare',quantity:0}])assert.equal(ticketDaycareLabel({lines:[line]}),'Not added');
 assert.equal(ticketDaycareLabel({daycareStatus:'STAYING',lines:[]}),'Staying');
});
