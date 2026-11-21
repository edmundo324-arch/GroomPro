require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function fixture(){
 let row;const customer={id:'customer',email:'customer@example.test'};const calls=[];const db={ticket:{findFirst:async({where})=>where.tenantId==='tenant'&&where.customerId==='customer'?{id:where.id}:null},customer:{findFirst:async({where})=>where.tenantId==='tenant'&&where.id==='customer'?customer:null},tenant:{findUniqueOrThrow:async()=>({name:'Test Grooming'})},communication:{create:async({data})=>{if(data.id&&row?.id===data.id)throw Object.assign(Error('duplicate'),{code:'P2002'});return row={id:'message',...data}},findFirst:async()=>row,update:async({data})=>(row={...row,...data}),updateMany:async({where,data})=>{if(row.deliveryStatus===where.deliveryStatus)row={...row,...data}},findUniqueOrThrow:async()=>row}};
 const env={GROOMPRO_AGREEMENT_EMAIL_TENANTS_JSON:JSON.stringify({tenant:{apiKey:'secret',from:'shop@example.test'}})};let response={ok:true,status:200,json:async()=>({id:'receipt'})};
 const api={};new Function('require','exports','process','fetch',ts.transpileModule(fs.readFileSync('src/lib/customer-email.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>name==='./message-provider-connection'?{messageProviderConnection:async(key,id)=>JSON.parse(env[key]||'{}')[id]||null}:name==='./email-replies'?{receivingDomain:value=>typeof value==='string'?value:null,prepareEmailReply:async()=> 'gp-test@replies.example.test'}:name==='./email-delivery'?require('../src/lib/email-delivery.ts'):{db},api,{env},async(...args)=>{calls.push(args);if(response instanceof Error)throw response;return response});
 return {api,env,calls,customer,delivered:()=>row={...row,externalId:'receipt',deliveryStatus:'DELIVERED'},setResponse:r=>response=r,send:()=>api.sendCustomerEmail({tenantId:'tenant',customerId:'customer',body:'Hello'})};
}
test('email sends only for the tenant/customer and records acceptance rather than delivery',async()=>{
 const f=fixture();await assert.rejects(f.api.sendCustomerEmail({tenantId:'other',customerId:'customer',body:'Hello'}));assert.equal(f.calls.length,0);
 const r=await f.send();assert.equal(r.communication.deliveryStatus,'ACCEPTED');assert.equal(r.communication.externalId,'receipt');assert.equal(r.communication.sentAt,undefined);
 assert.deepEqual(JSON.parse(f.calls[0][1].body),{from:'shop@example.test',to:['customer@example.test'],subject:'A message from Test Grooming',text:'Hello',tags:[{name:'groompro_communication',value:'message'}]});assert.equal(f.calls[0][1].headers['Idempotency-Key'],'communication-message');
});
test('unconfigured email stays saved without contacting provider',async()=>{const f=fixture();f.env.GROOMPRO_AGREEMENT_EMAIL_TENANTS_JSON='{}';assert.equal((await f.send()).communication.deliveryStatus,'NOT_CONFIGURED');assert.equal(f.calls.length,0)});
test('explicit rejection is failed; network/server/invalid receipts stay uncertain without retry',async()=>{
 const f=fixture();f.setResponse({ok:false,status:400});assert.equal((await f.send()).communication.deliveryStatus,'FAILED');
 for(const response of [Error('timeout'),{ok:false,status:503},{ok:true,status:200,json:async()=>({})}]){const g=fixture();g.setResponse(response);assert.equal((await g.send()).communication.deliveryStatus,'UNKNOWN');assert.equal(g.calls.length,1)}
});


test('receipt retries reuse the recorded request without sending twice, including unknown outcomes',async()=>{
 for(const outcome of [null,Error('timeout')]){
  const f=fixture();if(outcome)f.setResponse(outcome);
  const args={tenantId:'tenant',customerId:'customer',body:'Saved invoice',document:{id:'receipt-copy',ticketId:'ticket',subject:'Ticket 1',html:'<p>Saved invoice</p>',expectedEmail:'customer@example.test'}};
  const first=await f.api.sendCustomerEmail(args),second=await f.api.sendCustomerEmail(args);
  assert.equal(f.calls.length,1);assert.equal(first.communication.deliveryStatus,second.communication.deliveryStatus);assert.equal(second.communication.ticketId,'ticket');assert.equal(JSON.parse(f.calls[0][1].body).html,args.document.html);
 }
});
test('a changed recipient prevents receipt delivery',async()=>{
 const f=fixture();await assert.rejects(f.api.sendCustomerEmail({tenantId:'tenant',customerId:'customer',body:'Invoice',document:{id:'copy',ticketId:'ticket',subject:'Ticket',html:'<p>Invoice</p>',expectedEmail:'old@example.test'}}));assert.equal(f.calls.length,0);
});

test('appointment email preference is rechecked at delivery without blocking explicitly requested ordinary messages',async()=>{for(const [key,value] of [['appointmentEmail',false],['invalidEmail',true]]){const f=fixture();f.customer[key]=value;await assert.rejects(f.api.sendCustomerEmail({tenantId:'tenant',customerId:'customer',body:'Reminder',appointmentMessage:true}),/communication preferences/);assert.equal(f.calls.length,0);await f.send();assert.equal(f.calls.length,1);}});

test('a delivery callback arriving before the send response cannot be overwritten by acceptance',async()=>{const f=fixture();f.setResponse({ok:true,status:200,json:async()=>{f.delivered();return{id:'receipt'}}});const r=await f.send();assert.equal(r.communication.deliveryStatus,'DELIVERED');assert.match(r.message,/email server accepted/);});

test('vaccination reminders need no appointment and retry without sending a second copy',async()=>{const f=fixture(),args={tenantId:'tenant',customerId:'customer',body:'Vaccination expires soon',appointmentMessage:true,document:{id:'vax-copy',subject:'Vaccination reminder',html:'<p>Expires soon</p>',expectedEmail:'customer@example.test'}};const first=await f.api.sendCustomerEmail(args);await f.api.sendCustomerEmail(args);assert.equal(first.communication.ticketId,null);assert.equal(f.calls.length,1);});

test('an explicitly addressed gift card can go to a non-customer recipient without changing purchaser contact information',async()=>{const f=fixture(),args={tenantId:'tenant',customerId:'customer',body:'Your gift card',document:{id:'gift-copy',ticketId:'ticket',subject:'Gift card',html:'<p>Card</p>',expectedEmail:'recipient@example.test',recipientEmail:'recipient@example.test'}};f.customer.email=null;await f.api.sendCustomerEmail(args);assert.equal(JSON.parse(f.calls[0][1].body).to[0],'recipient@example.test');assert.equal(f.customer.email,null);await f.api.sendCustomerEmail(args);assert.equal(f.calls.length,1);await assert.rejects(f.api.sendCustomerEmail({...args,document:{...args.document,expectedEmail:'other@example.test',recipientEmail:'other@example.test'}}));assert.equal(f.calls.length,1);});

test('configured incoming replies use a saved reply address without changing the sender',async()=>{const f=fixture();f.env.GROOMPRO_AGREEMENT_EMAIL_TENANTS_JSON=JSON.stringify({tenant:{apiKey:'secret',from:'shop@example.test',receivingDomain:'replies.example.test'}});await f.send();const sent=JSON.parse(f.calls[0][1].body);assert.equal(sent.reply_to,'gp-test@replies.example.test');assert.equal(sent.from,'shop@example.test');});
