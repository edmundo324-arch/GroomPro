const test=require('node:test'),assert=require('node:assert/strict');require('./load-ts.cjs');const {reportReconciliation}=require('../src/lib/report-reconciliation.ts');
test('reconciliation separates actual linked balance payments from closed-line sales without reallocating partial payments',()=>{
 const payments=[{id:'p',amount:'75.00'}],closed=[{lines:[{description:'Bath',totalCents:10000},{description:'Customer Account Balance',totalCents:5000}]}];
 const settlements=[{referenceId:'p',entryType:'OWED',amountCents:-5000},{referenceId:'other',entryType:'OWED',amountCents:-9000},{referenceId:'p',entryType:'CREDIT',amountCents:-1000},{referenceId:null,entryType:'OWED',amountCents:-1000}];
 const before=JSON.stringify({payments,closed,settlements});assert.deepEqual(reportReconciliation(payments,closed,settlements),{collectedCents:7500,balancePaymentsCents:5000,otherPaymentsCents:2500,closedLineCents:15000,closedBalanceLinesCents:5000,closedLinesExcludingBalancesCents:10000});assert.equal(JSON.stringify({payments,closed,settlements}),before);
});
