require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {catalogInput}=require('../src/lib/catalog-input.ts');
const service={kind:'services',name:' Groom ',priceCents:6500,durationMin:60,active:true};
test('catalog validates money and duration without silently replacing bad input',()=>{assert.equal(catalogInput(service).name,'Groom');for(const priceCents of [-1,NaN,Infinity,1.5,'10'])assert.throws(()=>catalogInput({...service,priceCents}));for(const durationMin of [0,4,1441,NaN])assert.throws(()=>catalogInput({...service,durationMin}));assert.throws(()=>catalogInput({...service,commissionPct:101}));});
test('packages require distinct services and positive integer quantities',()=>{const pkg={kind:'packages',name:'Bundle',priceCents:100,active:true};assert.throws(()=>catalogInput({...pkg,items:[]}));assert.throws(()=>catalogInput({...pkg,items:[{serviceId:'a',quantity:0}]}));assert.throws(()=>catalogInput({...pkg,items:[{serviceId:'a',quantity:1},{serviceId:'a',quantity:2}]}));assert.equal(catalogInput({...pkg,items:[{serviceId:'a',quantity:2}]}).items[0].quantity,2)});


test('VIP plans have package items and validated recurring billing dates',()=>{const plan={kind:'plans',name:'VIP',priceCents:4500,active:true,items:[{serviceId:'bath',quantity:2,role:'BATH'}],billingDay:1,billingDaySecond:15};const result=catalogInput(plan);assert.equal(result.items[0].role,'BATH');assert.equal(result.billingDaySecond,15);for(const day of [29,30,31])assert.equal(catalogInput({...plan,billingDay:day}).billingDay,day);for(const change of [{billingDay:0},{billingDay:32},{billingDaySecond:1},{items:[]}])assert.throws(()=>catalogInput({...plan,...change}))});
