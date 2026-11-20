require('./load-ts.cjs');const test=require('node:test'),assert=require('node:assert/strict');
const {refundRequest,refundAvailable,validateRefund}=require('../src/lib/ticket-refund-rules.ts');
const ticket={status:'CLOSED',totalCents:12800,salesTaxCents:800,tipCents:2000,payments:[{amount:'128.00'}],lines:[{id:'groom',lineType:'SERVICE',totalCents:8000,quantity:1},{id:'brush',lineType:'PRODUCT',productId:'p',totalCents:2000,quantity:2}]};
const input=()=>refundRequest({id:'00000000-0000-4000-8000-000000000000',method:'CASH',reason:'Customer requested refund',items:[{lineId:'brush',amountCents:1000,returnQuantity:1}],taxCents:0,tipCents:0});
test('partial refunds preserve remaining amounts and stock-return quantities',()=>{const first=input(),record={...first,totalCents:1000};assert.equal(validateRefund(ticket,[],first).totalCents,1000);const available=refundAvailable(ticket,[record]);assert.equal(available.remainingCents,11800);assert.equal(available.lines[1].remainingCents,1000);assert.equal(available.lines[1].returnableQuantity,1);assert.throws(()=>validateRefund(ticket,[record],{...first,items:[{lineId:'brush',amountCents:1001,returnQuantity:1}]}));assert.throws(()=>validateRefund(ticket,[record],{...first,items:[{lineId:'brush',amountCents:1000,returnQuantity:2}]}));});
test('service items cannot return stock, and open tickets or excessive tax/tips cannot be refunded',()=>{assert.throws(()=>validateRefund({...ticket,status:'OPEN'},[],input()));assert.throws(()=>validateRefund(ticket,[],{...input(),taxCents:801}));assert.throws(()=>validateRefund(ticket,[],{...input(),tipCents:2001}));assert.throws(()=>validateRefund(ticket,[],{...input(),items:[{lineId:'groom',amountCents:100,returnQuantity:1}]}));});
test('stored-value purchases and old balance collections are not ordinary item refunds',()=>{const lines=[{id:'gift',lineType:'PRODUCT',sourceKey:'GIFT_CARD_ISSUE:abc'},{id:'prepaid',lineType:'SERVICE',sourceKey:'PREPAID_PURCHASE:abc'},{id:'old',lineType:'SERVICE',description:'Customer Account Balance'}].map(l=>({...l,totalCents:1000,quantity:1}));assert.equal(refundAvailable({...ticket,lines},[]).lines.length,0);});
test('invalid inputs and duplicate item selections are rejected before recording anything',()=>{const valid=input();for(const changes of [{method:'CARD'},{reason:''},{taxCents:-1},{tipCents:0.5},{items:[valid.items[0],valid.items[0]]}])assert.throws(()=>refundRequest({...valid,...changes}));});

test('refunded tips reverse employee shares proportionally and preserve every cent',()=>{
 const {proportionalTipReversal}=require('../src/lib/ticket-refund-rules.ts');
 assert.deepEqual(proportionalTipReversal(1500,3000,[{userId:'groomer',amountCents:2000},{userId:'bather',amountCents:1000}]),[{userId:'groomer',amountCents:1000},{userId:'bather',amountCents:500}]);
 let shares=[{userId:'a',amountCents:2},{userId:'b',amountCents:1}],remaining=3;
 while(remaining){const reversed=proportionalTipReversal(1,remaining,shares);assert.equal(reversed.reduce((n,r)=>n+r.amountCents,0),1);shares=shares.map(s=>({...s,amountCents:s.amountCents-(reversed.find(r=>r.userId===s.userId)?.amountCents||0)}));remaining--;}
 assert.equal(shares.reduce((n,s)=>n+s.amountCents,0),0);
 assert.deepEqual(proportionalTipReversal(1000,3000,[{userId:'a',amountCents:1500}]),[{userId:'a',amountCents:500}]);
 assert.throws(()=>proportionalTipReversal(1,100,[{userId:'a',amountCents:101}]));
});
