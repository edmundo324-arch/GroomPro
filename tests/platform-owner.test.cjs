const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {migrateOwnerRole,promoteCompanyOwners,isCompanyOwner}=require('../scripts/platform-owner-migration.cjs');
const compiled=ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/roles.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const roles={};new Function('exports',compiled)(roles);
test('Owner authority is higher than Developer and tenant Admin',()=>{
 assert.equal(roles.isPlatformRole('PLATFORM_OWNER'),true);
 assert.equal(roles.isPlatformRole('ADMIN'),false);
 assert.equal(roles.canManageRole('DEVELOPER','PLATFORM_OWNER'),false);
 assert.equal(roles.canManageRole('ADMIN','DEVELOPER'),false);
 assert.equal(roles.canManageRole('PLATFORM_OWNER','DEVELOPER'),true);
 assert.equal(roles.canManageRole('PLATFORM_OWNER','PLATFORM_OWNER'),true);
});
test('Only named company owners match, not Zagla Maria or Zagla Paz',()=>{
 for(const firstName of ['Edmundo','Zagla'])for(const lastName of ['Saenz','Saens','S'])assert.ok(isCompanyOwner({firstName,lastName}));
 assert.equal(isCompanyOwner({firstName:'Zagla Maria',lastName:'S'}),false);
 assert.equal(isCompanyOwner({firstName:'Zagla',lastName:'Paz'}),false);
});
test('Deployment promotes existing owners once, preserves other employees and future namesakes',async()=>{
 let marker,updates=[],audits=[];
 const users=[{id:'owner',tenantId:'development',firstName:'Edmundo',lastName:'Saenz',role:'DEVELOPER'},{id:'groomer',tenantId:'development',firstName:'Zagla Maria',lastName:'S',role:'GROOMER'}];
 const db={$queryRaw:async()=>marker?[{checksum:marker}]:[],$executeRaw:async(s,version,checksum)=>{marker=checksum;},user:{findMany:async()=>users,update:async v=>updates.push(v)},auditEntry:{create:async v=>audits.push(v)}};
 assert.equal(await promoteCompanyOwners(db),1);
 assert.equal(updates[0].where.id,'owner');assert.equal(updates[0].data.role,'PLATFORM_OWNER');assert.equal(audits.length,1);
 users.push({id:'future',firstName:'Zagla',lastName:'Saenz',role:'ADMIN'});
 assert.equal(await promoteCompanyOwners(db),0);assert.equal(updates.length,1);
});
test('Role enum migration appends Owner without changing existing roles and is repeatable',async()=>{
 let statements=[];
 const db={$queryRawUnsafe:async()=>[{columnType:"enum('ADMIN','DEVELOPER')"}],$executeRawUnsafe:async s=>statements.push(s)};
 await migrateOwnerRole(db);assert.equal(statements.length,2);assert.ok(statements.every(s=>s.includes("enum('ADMIN','DEVELOPER','PLATFORM_OWNER')")));
 db.$queryRawUnsafe=async()=>[{columnType:"enum('ADMIN','DEVELOPER','PLATFORM_OWNER')"}];await migrateOwnerRole(db);assert.equal(statements.length,2);
});
