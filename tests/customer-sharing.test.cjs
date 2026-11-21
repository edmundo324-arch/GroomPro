const test=require('node:test'),assert=require('node:assert/strict');require('./load-ts.cjs');
const {sharingScope,validateGroups,sharedLocations}=require('../src/lib/customer-sharing-context.ts');
const {scopeQuery,checkSharingReferences,scopedClient}=require('../src/lib/customer-sharing-query.ts');
const scope={tenantId:'t',locationId:'a',locations:['a','b']};
test('sharing groups require every shop exactly once',()=>{
 assert.throws(()=>validateGroups([{id:'g',name:'G',locationIds:['a','a']}],['a','b']),/exactly/);
 assert.throws(()=>validateGroups([{id:'g',name:'G',locationIds:['a']}],['a','b']),/every/);
 const groups=validateGroups([{id:'g',name:'G',locationIds:['a','b']}],['a','b']);assert.deepEqual(sharedLocations({groups},'b'),['a','b']);assert.deepEqual(sharedLocations({groups},'other'),[]);
});
test('scope is absent for unchanged shared businesses',()=>assert.deepEqual(scopeQuery('Customer',{where:{active:true}}),{where:{active:true}}));
test('customer, ticket and nested Whiteboard queries enforce the same group',()=>sharingScope.run(scope,()=>{
 const customer=scopeQuery('Customer',{where:{id:'c',OR:[{active:true}]}});assert.equal(customer.where.id,'c');assert.equal(customer.where.AND[0].locationAccess.some.locationId,'a');assert.deepEqual(customer.where.OR,[{active:true}]);
 const ticket=scopeQuery('Ticket',{});assert.equal(ticket.where.AND[0].customer.locationAccess.some.tenantId,'t');
 const board=scopeQuery('WhiteboardSnapshot',{include:{items:{include:{ticket:true}}}});assert.equal(board.include.items.where.AND[0].ticket.customer.locationAccess.some.locationId,'a');
}));
test('changing or connecting another shop customer fails before a write',async()=>sharingScope.run(scope,async()=>{
 let writes=0;const client={customer:{findFirst:async()=>null},ticket:{create:async()=>{writes++}}};
 await assert.rejects(checkSharingReferences(client,{customer:{connect:{id:'private'}}}),/not shared/);
 await assert.rejects(scopedClient(client).ticket.create({data:{customerId:'private'}}),/not shared/);assert.equal(writes,0);
}));
test('concurrent shop contexts do not leak into each other',async()=>{
 await Promise.all(['a','z'].map(locationId=>sharingScope.run({...scope,locationId},async()=>{await new Promise(r=>setTimeout(r,2));assert.equal(scopeQuery('Customer').where.AND[0].locationAccess.some.locationId,locationId)})));
 assert.deepEqual(scopeQuery('Customer'),{});
});
test('raw membership rows are filtered by their customer before returning',async()=>sharingScope.run(scope,async()=>{
 const client={$queryRaw:async()=>[{id:'m1',customerId:'allowed'},{id:'m2',customerId:'private'}],customer:{findMany:async()=>[{id:'allowed'}]}};
 assert.deepEqual(await scopedClient(client).$queryRaw(['SELECT']),[{id:'m1',customerId:'allowed'}]);
}));
test('new customers receive their group and home shop atomically',async()=>sharingScope.run(scope,async()=>{
 let saved,home,transactions=0;const tx={$queryRaw:async()=>[],customer:{create:async args=>{saved=args;return{id:'new'}}},tenantSetting:{findUnique:async()=>null,upsert:async args=>{home=args}}};const client={...tx,$transaction:async fn=>{transactions++;return fn(tx)}};
 await scopedClient(client).customer.create({data:{tenantId:'t',firstName:'A'}});
 assert.equal(transactions,1);assert.deepEqual(saved.data.locationAccess.create,[{tenantId:'t',locationId:'a'},{tenantId:'t',locationId:'b'}]);assert.equal(home.create.value.locationId,'a');
}));

test('customer creation uses current groups after acquiring the configuration lock',async()=>sharingScope.run(scope,async()=>{
 let access;const tx={$queryRaw:async()=>[],tenantSetting:{findUnique:async()=>({value:{groups:[{id:'new',name:'New',locationIds:['a','z']}]}}),upsert:async()=>{}},customer:{create:async args=>{access=args.data.locationAccess.create;return{id:'new'}}}};
 await scopedClient({...tx,$transaction:async fn=>fn(tx)}).customer.create({data:{tenantId:'t'}});assert.deepEqual(access.map(r=>r.locationId),['a','z']);
}));

test('a scoped transaction does not invent a nested transaction method during PIN assignment',async()=>{
 const tx={user:{update:async()=>({id:'worker'})}};let transactions=0;
 const client=scopedClient({$transaction:async work=>{transactions++;return work(tx)}});
 await client.$transaction(async scoped=>{assert.equal(scoped.$transaction,undefined);assert.deepEqual(await scoped.user.update({}),{id:'worker'});});assert.equal(transactions,1);
});

test('employee PIN reset inside the shared transaction saves credentials and revokes old sessions',async()=>{
 const ts=require('typescript'),fs=require('fs'),api={},pin=require('../src/lib/pin.ts');let locked=false,saved,revoked=false;
 const tx={$queryRaw:async()=>{locked=true},user:{findMany:async()=>[],update:async q=>{saved=q.data;return{id:'employee'}}},tenantSetting:{deleteMany:async()=>{}},employeeSession:{updateMany:async()=>{revoked=true}}};
 const deps={'./db':{},'./pin':pin,'./pin-vault':{pinVaultConfigured:()=>false,pinVaultKey:id=>'PIN:'+id}};
 new Function('require','exports',ts.transpileModule(fs.readFileSync('src/lib/employee-pin-assignment.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(k=>deps[k],api);
 await api.saveWithPin('tenant','945123','employee',{},scopedClient(tx));assert.equal(locked,true);assert.equal(revoked,true);assert.equal(await pin.verifyPin('945123',saved.pinHash),true);assert.equal(saved.pinPrefixHashes.length,3);
});
