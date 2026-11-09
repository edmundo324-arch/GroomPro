const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require('./load-ts.cjs');
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

test('Employee editor offers Developer to Owners for new and existing employees',()=>{
 for(const current of ['FRONT','ADMIN','GROOMER'])assert.ok(roles.employeeEditorRoles('PLATFORM_OWNER',current).includes('DEVELOPER'));
 assert.equal(roles.employeeEditorRoles('ADMIN','FRONT').includes('DEVELOPER'),false);
 assert.equal(roles.employeeEditorRoles('MANAGER','FRONT').includes('DEVELOPER'),false);
 assert.equal(roles.employeeEditorRoles('DEVELOPER','FRONT').includes('PLATFORM_OWNER'),false);
 assert.ok(roles.employeeEditorRoles('PLATFORM_OWNER','PLATFORM_OWNER').includes('PLATFORM_OWNER'));
});

test('pilot workspaces use a stable identity and anonymous requests only reach setup and PIN endpoints',()=>{
 const {pilotBusinessInput}=require('../src/lib/platform-business.ts');
 const {businessId,mayOpenBusinessWithoutPin}=require('../src/lib/business-context.ts');
 const input={name:' Grand  Grooming ',location:'Main Location',timezone:'America/Chicago'};
 const first=pilotBusinessInput(input);
 assert.equal(first.name,'Grand Grooming');assert.equal(first.id,pilotBusinessInput({...input,name:'grand grooming'}).id);
 assert.equal(businessId(first.id),true);assert.throws(()=>pilotBusinessInput({...input,timezone:'Invalid'}));
 assert.equal(mayOpenBusinessWithoutPin('/api/employee/session','POST'),true);
 for(const path of ['/api/customers/search','/api/tickets','/api/catalog','/api/platform-access'])assert.equal(mayOpenBusinessWithoutPin(path,'GET'),false,path);
});

test('opening a pilot requires a current platform session and the linked access ends when the home role is revoked',async()=>{
 const {pilotBusinessInput,openBusinessSession,currentBusinessSession}=require('../src/lib/platform-business.ts');
 const target=pilotBusinessInput({name:'Grand Grooming',location:'Main Location',timezone:'America/Chicago'}).id;
 const home={id:'owner',tenantId:'main',role:'PLATFORM_OWNER',active:true,firstName:'Edmundo',lastName:'Saenz'};
 let operator,session,originalEnded=false;
 const tx={$queryRaw:async()=>[],tenant:{findUnique:async()=>({id:target,name:'Grand Grooming',locations:[{id:'pilot-location'}]})},
  user:{findUnique:async({where})=>where.id==='owner'?home:operator?.id===where.id?operator:null,
   upsert:async({create})=>operator={...create,active:true}},
  employeeSession:{updateMany:async({where})=>{if(!where.id)return {count:0};if(originalEnded||where.id!=='home-session')return {count:0};originalEnded=true;return {count:1}},
   create:async({data})=>session={...data,id:'pilot-session',lastActiveAt:new Date(),user:operator},
   findFirst:async({where})=>where.id===session?.id&&where.tenantId===session.tenantId&&where.deviceId===session.deviceId?session:null},
  auditEntry:{create:async()=>{}},tenantSetting:{findUnique:async()=>null,findMany:async()=>[]}};
 await assert.rejects(openBusinessSession(tx,{...home,role:'ADMIN'},'home-session',target,'device'));
 const opened=await openBusinessSession(tx,home,'home-session',target,'device');
 assert.equal(opened.tenant.id,target);assert.equal(operator.tenantId,target);assert.equal(operator.pinHash,'IMPORT_DISABLED');
 assert.ok(await currentBusinessSession(tx,target,'pilot-session','device'));
 assert.equal(await currentBusinessSession(tx,target,'pilot-session','other-device'),null);
 await assert.rejects(openBusinessSession(tx,home,'home-session',target,'device'));
 home.role='ADMIN';
 assert.equal(await currentBusinessSession(tx,target,'pilot-session','device'),null);
});

test('a business owner needs a name and PIN and is scoped to the business and first location',async()=>{
 const {businessOwnerInput,businessOwnerKey,saveBusinessOwner}=require('../src/lib/platform-business.ts');
 assert.throws(()=>businessOwnerInput({pin:'123456'}),/first and last name/);
 assert.throws(()=>businessOwnerInput({firstName:'Taylor',lastName:'Reed',pin:'123'}),/6–10 digit PIN/);
 const owner=businessOwnerInput({firstName:' Taylor ',lastName:' Reed ',pin:'123456',role:'PLATFORM_OWNER'});
 let user,setting;
 const tx={$queryRaw:async()=>[],user:{findMany:async()=>[],create:async({data})=>{user=data;return {id:'new-owner'}}},
  tenantSetting:{deleteMany:async()=>{},upsert:async()=>{},create:async({data})=>{setting=data}}};
 assert.equal(await saveBusinessOwner(tx,'business','location',owner),'new-owner');
 assert.equal(user.role,'ADMIN');assert.equal(user.tenantId,'business');assert.equal(user.locationId,'location');
 assert.equal(user.firstName,'Taylor');assert.notEqual(user.pinHash,owner.pin);assert.ok(!('pin' in user));
 assert.deepEqual(setting,{tenantId:'business',settingKey:businessOwnerKey,value:{userId:'new-owner'}});
});
