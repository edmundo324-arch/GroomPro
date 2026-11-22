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

const {tipTeam,percentageTip}=require('../src/lib/ticket-tips.ts');
test('tip team includes package employees once, excludes other dogs and uses package work roles',()=>{
 const lines=[{petId:'dog',packageId:'p',role:'PREP',assignedUserId:'preparer'},{petId:'dog',packageId:'p',role:'BATH'},{petId:'dog',packageId:'p',role:'GROOM',assignedUserId:'groomer'}];
 assert.deepEqual(tipTeam(lines,[{petId:'dog',userId:'groomer'},{petId:'absent',userId:'other'}]),[{userId:'preparer',roles:['PREP']},{userId:'groomer',roles:['GROOM']}]);
});
test('role split distributes 40 dollars exactly, sharing a role and preserving cents',()=>{
 const team=[{userId:'g',roles:['GROOM']},{userId:'b1',roles:['BATH']},{userId:'b2',roles:['BATH']},{userId:'p',roles:['PREP']}];
 const result=percentageTip(4001,team,{GROOM:50,BATH:30,PREP:20});
 assert.equal(result.reduce((a,b)=>a+b.amountCents,0),4001);assert.equal(result.find(s=>s.userId==='g').amountCents,2001);assert.equal(result.find(s=>s.userId==='b1').amountCents,600);
 assert.throws(()=>percentageTip(4000,team,{GROOM:50}),/100%/);
});
