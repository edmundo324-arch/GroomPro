require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,deps){const api={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)((dependency=>dependency==='./report-calculations'?require('../src/lib/report-calculations.ts'):(n=>{if(!(n in deps))throw Error(n);return deps[n]})(dependency)),api);return api;}
test('refund access requires a signed-in manager and uses the verified tenant and actor',async()=>{
 let session=null,calls=[];const api=load('app/api/tickets/refunds/route.ts',{'next/server':{NextResponse:{json:(body,opts)=>({body,status:opts?.status||200})}},'@/src/lib/platform-access':{platformSession:async()=>session},'@/src/lib/request-policy':{withRequestPolicy:f=>f},'@/src/lib/ticket-refunds':{recordTicketRefund:async(...args)=>{calls.push(args);return{ok:true}},readTicketRefunds:async()=>({})}});
 const request={method:'POST',json:async()=>({ticketId:'t',tenantId:'attacker',actorUserId:'attacker'})};
 assert.equal((await api.POST(request)).status,401);session={tenantId:'shop-tenant',user:{id:'staff',role:'FRONT'}};assert.equal((await api.POST(request)).status,403);assert.equal(calls.length,0);
 session.user.role='MANAGER';assert.equal((await api.POST(request)).status,200);assert.deepEqual(calls[0].slice(0,3),['shop-tenant','staff','t']);assert.equal(calls[0][4],'REVERSE');
});
test('refund reports honor tenant, shop and accessible tickets and use the refund date',async()=>{
 const row=(ticketId,locationId,method)=>({id:ticketId,ticketId,locationId,method,recordedAt:'2026-11-19T10:00:00Z',originalClosedAt:'2026-10-01',totalCents:1080,taxCents:80,tipCents:0,items:[{commissionReversalCents:200}]}),queries=[];
 const db={tenantSetting:{findMany:async q=>{queries.push(q);return[row('allowed','shop','CASH'),row('hidden','shop','CREDIT'),row('other','elsewhere','CASH')].map(value=>({value}))}},ticket:{findMany:async q=>{queries.push(q);return[{id:'allowed'}]}}};const api=load('src/lib/report-refunds.ts',{'./db':{db}});
 const records=await api.refundReportRecords('tenant','shop');assert.equal(records.length,1);assert.equal(queries[0].where.tenantId,'tenant');assert.equal(queries[1].where.tenantId,'tenant');assert.equal(queries[1].where.locationId,'shop');assert.deepEqual(queries[1].where.id.in,['allowed','hidden']);
 const report=api.refundReport(records,new Date('2026-11-01'),new Date('2026-12-01'));assert.equal(report.cashCents,1080);assert.equal(report.creditCents,0);assert.equal(report.taxCents,80);assert.equal(report.commissionCents,200);assert.equal(api.refundReport(records,new Date('2026-10-01'),new Date('2026-11-01')).rows.length,0);
});
