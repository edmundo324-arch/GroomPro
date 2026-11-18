const test=require('node:test'),assert=require('node:assert/strict');require('./load-ts.cjs');const {reportCsv}=require('../src/lib/report-export.ts');
test('CSV keeps current calculations, prior-only rows, scope and offline snapshot date',()=>{
 const data={start:'2026-11-01',end:'2026-12-01',offlineReport:true,offlineSavedAt:'2026-11-18T12:00:00Z',closedSalesCents:12345,serviceSales:[{id:'s',name:'Bath, "full"',amountCents:12345,quantity:2}],previous:{closedSalesCents:500,serviceSales:[{id:'old',name:'Old service',amountCents:500,quantity:1}]}};
 const before=JSON.stringify(data),csv=reportCsv(data,'Shop');assert.equal(JSON.stringify(data),before);
 assert.ok(csv.includes('"Closed-ticket sales","123.45","5.00"'));assert.ok(csv.includes('"Bath, ""full"""'));assert.ok(csv.includes('"Old service","0.00","5.00"'));assert.ok(csv.includes('Saved offline report'));assert.ok(csv.includes(data.offlineSavedAt));assert.ok(csv.includes('all accessible customer records'));
});
test('CSV neutralizes spreadsheet formulas in customer-controlled names',()=>{
 const csv=reportCsv({referrals:{'=HYPERLINK("bad")':1,'\t+formula':2}},'@formula');assert.ok(csv.includes('"\'@formula"'));assert.ok(csv.includes('"\'=HYPERLINK'));assert.ok(csv.includes('"\'\t+formula"'));
});
