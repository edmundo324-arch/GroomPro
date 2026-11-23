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

const {dogTipTeams,percentageTipByDog}=require('../src/lib/ticket-tips.ts');
test('each dog receives half before work roles are divided, including one worker doing all Full Wash work',()=>{
 const lines=[{petId:'fw',role:'PREP',assignedUserId:'anton'},{petId:'fw',role:'BATH',assignedUserId:'anton'},{petId:'gr',role:'PREP',assignedUserId:'anton'},{petId:'gr',role:'BATH',assignedUserId:'anton'},{petId:'gr',role:'GROOM',assignedUserId:'kandance'}];
 assert.deepEqual(percentageTipByDog(6000,dogTipTeams(lines,[]),{PREP:5,BATH:45,GROOM:50}),[{userId:'anton',amountCents:4500},{userId:'kandance',amountCents:1500}]);
});
test('package assignment covers unassigned work, while explicit workers take precedence',()=>{
 const dogs=dogTipTeams([{petId:'dog',role:'PREP',assignedUserId:'prep'},{petId:'dog',role:'BATH'},{petId:'dog',role:'GROOM'}],[{petId:'dog',userId:'groomer'}]);
 assert.deepEqual(percentageTipByDog(2000,dogs,{PREP:5,BATH:45,GROOM:50}),[{userId:'groomer',amountCents:1900},{userId:'prep',amountCents:100}]);
 assert.equal(percentageTipByDog(2001,dogTipTeams([{petId:'dog',role:'GROOM',assignedUserId:'solo'}],[]),{})[0].amountCents,2001);
});

test('Full Wash uses its separate saved percentages, preserving the Grooming rule',()=>{
 const dogs=dogTipTeams([{petId:'fw',role:'PREP',assignedUserId:'p'},{petId:'fw',role:'BATH',assignedUserId:'b'},{petId:'gr',role:'PREP',assignedUserId:'p'},{petId:'gr',role:'BATH',assignedUserId:'b'},{petId:'gr',role:'GROOM',assignedUserId:'g'}],[]);
 const result=percentageTipByDog(4000,dogs,{PREP:5,BATH:45,GROOM:50},{PREP:20,BATH:80});
 assert.deepEqual(Object.fromEntries(result.map(s=>[s.userId,s.amountCents])),{b:2500,p:500,g:1000});assert.throws(()=>percentageTipByDog(4000,dogs,{PREP:5,BATH:45,GROOM:50}),/Set Full Wash/);
});
