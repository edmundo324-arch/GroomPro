require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {publicPlans}=require('../src/lib/public-sales-content.ts');
test('public pricing is empty until approved and rejects malformed or negative prices',()=>{for(const input of [undefined,'invalid','{}','[{"name":"Plan","monthlyCents":-1,"features":[]}]','[{"name":"Plan","monthlyCents":1.5,"features":[]}]'])assert.deepEqual(publicPlans(input),[])});
test('public plans disclose only explicitly supported public fields',()=>{assert.deepEqual(publicPlans(JSON.stringify([{name:'Test Plan',monthlyCents:1234,features:['Calendar'],privateNotes:'Never publish'}])),[{name:'Test Plan',monthlyCents:1234,features:['Calendar']}])});
