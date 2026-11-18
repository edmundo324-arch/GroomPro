const test=require('node:test'),assert=require('node:assert/strict');require('./load-ts.cjs');
const {splitTip,validateTipShares}=require('../src/lib/ticket-tips.ts');
test('tips split exactly once per employee and preserve every cent',()=>{
 assert.deepEqual(splitTip(3000,['groomer','bather','preparer']).map(r=>r.amountCents),[1000,1000,1000]);
 assert.deepEqual(splitTip(1000,['b','a','a','c']),[{userId:'a',amountCents:334},{userId:'b',amountCents:333},{userId:'c',amountCents:333}]);assert.throws(()=>splitTip(500,[]),/Assign/);
});
test('manual allocations require the exact total and valid distinct employees',()=>{
 const allowed=new Set(['g','b','p']),shares=[{userId:'g',amountCents:1500},{userId:'b',amountCents:1000},{userId:'p',amountCents:500}];assert.deepEqual(validateTipShares(shares,3000,allowed),shares);
 assert.throws(()=>validateTipShares(shares,2000,allowed),/add up/);assert.throws(()=>validateTipShares([{userId:'outside',amountCents:3000}],3000,allowed),/Choose/);assert.throws(()=>validateTipShares([{userId:'g',amountCents:1500},{userId:'g',amountCents:1500}],3000,allowed),/Choose/);
});
