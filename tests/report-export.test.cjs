const test=require('node:test'),assert=require('node:assert/strict');require('./load-ts.cjs');const {reportCsv}=require('../src/lib/report-export.ts');
test('CSV keeps current calculations, prior-only rows, scope and offline snapshot date',()=>{
 const data={start:'2026-11-01',end:'2026-12-01',offlineReport:true,offlineSavedAt:'2026-11-18T12:00:00Z',closedSalesCents:12345,serviceSales:[{id:'s',name:'Bath, "full"',amountCents:12345,quantity:2}],previous:{closedSalesCents:500,serviceSales:[{id:'old',name:'Old service',amountCents:500,quantity:1}]}};
 const before=JSON.stringify(data),csv=reportCsv(data,'Shop');assert.equal(JSON.stringify(data),before);
 assert.ok(csv.includes('"Closed-ticket sales","123.45","5.00"'));assert.ok(csv.includes('"Bath, ""full"""'));assert.ok(csv.includes('"Old service","0.00","5.00"'));assert.ok(csv.includes('Saved offline report'));assert.ok(csv.includes(data.offlineSavedAt));assert.ok(csv.includes('all accessible customer records'));
});
test('CSV neutralizes spreadsheet formulas in customer-controlled names',()=>{
 const csv=reportCsv({referrals:{'=HYPERLINK("bad")':1,'\t+formula':2}},'@formula');assert.ok(csv.includes('"\'@formula"'));assert.ok(csv.includes('"\'=HYPERLINK'));assert.ok(csv.includes('"\'\t+formula"'));
});

test('employee export includes current and prior-only earnings, time basis and incomplete assignments',()=>{
 const data={employeeWork:{scope:'TEAM',asOf:'2026-11-18T12:00:00Z',unallocatedTipCents:500,invalidRecords:0,rows:[{id:'a',name:'Alex',elapsedMinutes:120,breakMinutes:30,minutesExcludingBreaks:90,openShifts:1,commissionCents:2000,tipCents:1000}]},previous:{employeeWork:{rows:[{id:'b',name:'Former employee',commissionCents:500,tipCents:200}],unallocatedTipCents:0}}};
 const csv=reportCsv(data,'Shop');assert.ok(csv.includes('"Alex — Hours excluding breaks","1.50","0.00"'));assert.ok(csv.includes('"Former employee — Assigned tips","0.00","2.00"'));assert.ok(csv.includes('"Unallocated tips","5.00","0.00"'));assert.ok(csv.includes('original ticket closing date, including later tips'));assert.ok(csv.includes(data.employeeWork.asOf));
});


test('sales and receivables exports preserve separate bases and prior-only groups',()=>{
 const csv=reportCsv({salesBreakdowns:{netLineSalesCents:500,products:[{id:'p',name:'Brush',amountCents:500}],packages:[],employees:[],days:[]},previous:{salesBreakdowns:{netLineSalesCents:200,products:[{id:'old',name:'Old product',amountCents:200}],packages:[],employees:[],days:[]}},receivables:{asOf:'2030-01-01',accounts:[{name:'Customer',balanceCents:1000,creditCents:100}],openTickets:[{orderNumber:2,name:'Customer',status:'OPEN',totalCents:1500,paidCents:500,dueCents:1000}]}},'Shop');
 assert.match(csv,/Old product/);assert.match(csv,/do not add/i);assert.match(csv,/Outstanding balances snapshot/);assert.match(csv,/"Balance owed","10.00","Credit","1.00"/);assert.match(csv,/"Due","10.00"/);
});
test('stage-time and VIP-payment exports retain the displayed units and previous-period groups',()=>{const csv=reportCsv({careStages:{rows:[{id:'a',name:'Acclimation',started:1,completed:1,incomplete:0,invalid:0,totalSeconds:120,averageSeconds:120}]},membershipPayments:{rows:[]},previous:{careStages:{rows:[{id:'a',averageSeconds:180}]},membershipPayments:{rows:[{name:'Earlier plan',amountCents:12345}]}}},'Shop');assert.match(csv,/"Acclimation","1","1","0","0","2.0","2.0","3.0"/);assert.match(csv,/"Earlier plan","0","0.00","0.00","123.45"/);});
test('sales-refund reconciliation exports the separate bases and unavailable net without inventing zero',()=>{const csv=reportCsv({salesBreakdowns:{reconciliation:{salesCents:6000,refundCents:1000,netCents:null,giftCardRefundCents:2000,balanceRefundCents:500,unclassifiedRefundCents:100,voidCents:4500}}},'Shop');assert.match(csv,/"Sales less recorded refunds","Needs review"/);assert.match(csv,/"Gift-card purchase refunds \(separate from sales\)","20.00"/);assert.match(csv,/"Voided unpaid ticket totals \(not deducted again\)","45.00"/);assert.match(csv,/Closing-date sales less refunds recorded in this period/)});
