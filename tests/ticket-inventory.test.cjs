const test=require('node:test'),assert=require('node:assert/strict');require('./load-ts.cjs');
const {subtractTicketStock}=require('../src/lib/ticket-inventory.ts');
function fixture(){
 const products={a:{id:'a',name:'Shampoo',quantity:3},b:{id:'b',name:'Brush',quantity:6}},audits=[],locks=[];
 const tx={$queryRaw:async(strings,id,tenant)=>{assert.equal(tenant,'tenant');locks.push(id);return products[id]?[products[id]]:[]},product:{updateMany:async({where,data})=>{assert.equal(where.tenantId,'tenant');products[where.id].quantity=data.quantity;return {count:1}}},auditEntry:{create:async({data})=>{audits.push(data)}}};
 const run=lines=>subtractTicketStock(tx,'tenant',{id:'ticket',customerId:'customer',orderNumber:1,lines},'employee');return {products,audits,locks,run};
}
const line=(productId,quantity=1)=>({productId,quantity,lineType:'PRODUCT',description:'Product'});
test('aggregates duplicate products, locks in stable order, and ignores services',async()=>{
 const f=fixture();assert.deepEqual(await f.run([line('b',2),line('a'),line('b'),{...line('a',10),lineType:'SERVICE'}]),[]);
 assert.deepEqual(f.locks,['a','b']);assert.equal(f.products.a.quantity,2);assert.equal(f.products.b.quantity,3);assert.equal(f.audits.length,2);assert.equal(f.audits[1].details.sold,3);
});
test('short stock completes with zero stock and durable shortage warning',async()=>{
 const f=fixture(),warnings=await f.run([line('a',5)]);assert.equal(f.products.a.quantity,0);assert.match(warnings[0],/2 short/);assert.deepEqual(f.audits[0].details,{ticketId:'ticket',sold:5,before:3,after:0,shortage:2});assert.equal(f.audits[1].action,'INVENTORY_WARNING');
});
test('unlinked, invalid, and missing products warn without changing unrelated stock',async()=>{
 const f=fixture(),warnings=await f.run([line(null),line('a',-1),line('missing')]);assert.equal(warnings.length,3);assert.equal(f.products.a.quantity,3);assert.equal(f.audits.length,1);
});

test('checkout snapshots unit cost before future product cost edits',async()=>{const f=fixture();f.products.a.costCents=275;await f.run([line('a',2)]);f.products.a.costCents=999;assert.equal(f.audits[0].details.unitCostCents,275);assert.equal(f.audits[0].details.costCents,550);assert.equal(f.audits[0].details.productName,'Shampoo');});
