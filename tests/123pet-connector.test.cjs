const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(file){const filename=path.resolve(file),module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,Buffer,process,Date,require:id=>id.startsWith('.')?load(path.resolve(path.dirname(filename),id)+'.ts'):require(id)},{filename});return module.exports;}
const control=load('src/lib/integrations/123pet/control.ts'),mapping=load('src/lib/integrations/123pet/manifest.ts'),profiles=load('src/lib/integrations/123pet/profiles.ts'),inbox=load('src/lib/integrations/123pet/inbox.ts');
const tickets=load('src/lib/integrations/123pet/tickets.ts'),ticketMapping=load('src/lib/integrations/123pet/ticket-mapping.ts');
test('ticket bundles reject cross-ticket lines and duplicates across pages',()=>{
 const manifest=mapping.readManifest(schema());
 const row=table=>Object.fromEntries(manifest.find(x=>x.table===table).columns.map(k=>[k,null]));
 const summary={...row('tblTicketsSummary'),fldPK:1,fldTicketID:1000};
 const line={...row('tblTicketsRow'),fldPK:2,fldTicketID:1000};
 assert.equal(tickets.validateTicketBundle(schema(),{summary,rows:[line]}).rows.length,1);
 assert.throws(()=>tickets.validateTicketBundle(schema(),{summary,rows:[{...line,fldTicketID:1001}]}));
 const rows=Array.from({length:101},(_,i)=>({...line,fldPK:i}));rows[100].fldPK=0;
 assert.throws(()=>tickets.validateTicketBundle(schema(),{summary,rows}));
});
test('source appointment clock is preserved outside business hours and money must reconcile',()=>{
 const summary={fldTicketType:0,fldTicketStatus:'Voided',fldClientID:1,fldTotal:'80.0000'};
 const line={fldPK:1,fldPS:'S',fldDescription:'Groom',fldQuantity:'1.00',fldPrice:'80.0000',fldRowTotal:'80.0000',fldPetID:2,fldEmployeeID:3,fldStartDateTime:'2026-09-15T05:00:00.000',fldEndDateTime:'2026-09-15T06:00:00.000'};
 const result=ticketMapping.mapTicket(summary,[line],'America/Chicago',(table,id)=>table+id);
 assert.equal(result.data.status,'CANCELLED');assert.equal(result.data.scheduledStart.toISOString(),'2026-09-15T10:00:00.000Z');
 assert.equal(result.data.totalCents,8000);assert.equal(result.lines[0].data.assignedUserId,'tblEmployees3');
 assert.throws(()=>ticketMapping.mapTicket({...summary,fldTotal:'90'},[line],'America/Chicago',()=> 'id'));
 assert.throws(()=>ticketMapping.mapTicket(summary,[line],'America/Chicago',table=>table==='tblEmployees'?null:'id'));
});
test('ticket replay creates one ticket; changed payment is staged without touching native money',async()=>{
 process.env.GROOMPRO_IMPORT_KEY='ab'.repeat(32);
 const crypto=load('src/lib/import/crypto.ts'),manifest=mapping.readManifest(schema());
 const blank=table=>Object.fromEntries(manifest.find(x=>x.table===table).columns.map(k=>[k,null]));
 const summary={...blank('tblTicketsSummary'),fldPK:1,fldTicketID:1000,fldTicketType:0,fldTicketStatus:'Closed',fldClientID:1,fldTotal:'80',fldTender1:'80',fldPayType1:'Cash',fldDateClosed:'2026-09-15T00:00:00.000',fldTimeClosed:'1899-12-30T07:00:00.000'};
 const line={...blank('tblTicketsRow'),fldPK:2,fldTicketID:1000,fldPS:'S',fldDescription:'Groom',fldQuantity:'1',fldPrice:'80',fldRowTotal:'80',fldPetID:2,fldStartDateTime:'2026-09-15T05:00:00.000',fldEndDateTime:'2026-09-15T06:00:00.000'};
 let record=null,native=null,creates=0,updates=0;
 const tx={tenantSetting:{upsert:async()=>{}},location:{findMany:async()=>[{id:'location',timezone:'America/Chicago'}]},pet:{findFirst:async()=>({id:'pet'})},posDraft:{aggregate:async()=>({_max:{orderNumber:0}})},auditEntry:{create:async()=>{}},
 importRecord:{findUnique:async()=>record,findMany:async()=>[{entityType:'SOURCE:tblClients',sourceId:'1',targetId:'customer',payload:{encrypted:crypto.seal({},'tenant')}},{entityType:'SOURCE:tblPets',sourceId:'2',targetId:'pet',payload:{encrypted:crypto.seal({},'tenant')}}],upsert:async({create,update})=>{record=record?{...record,...update}:create}},
 ticket:{aggregate:async()=>({_max:{orderNumber:0}}),findFirst:async()=>native,update:async()=>{updates++},create:async({data})=>{creates++;const {lines,pets,payments,...rest}=data;native={...rest,lines:lines.create.map((x,i)=>({...x,id:'line'+i})),pets:pets.create.map((x,i)=>({...x,id:'pet'+i})),payments:payments.create.map((x,i)=>({...x,id:'pay'+i}))}}}};
 const message={summary,rows:[line]};
 assert.equal((await tickets.receiveTicketBundle(tx,'tenant','connector',schema(),message)).state,'APPLIED');
 assert.equal((await tickets.receiveTicketBundle(tx,'tenant','connector',schema(),message)).unchanged,1);assert.equal(creates,1);
 const saved=JSON.stringify(native);
 const corrected={summary:{...summary,fldTender1:'90',fldChange:'10'},rows:[line]};
 assert.equal((await tickets.receiveTicketBundle(tx,'tenant','connector',schema(),corrected)).state,'REVIEW');
 assert.equal((await tickets.receiveTicketBundle(tx,'tenant','connector',schema(),corrected)).state,'REVIEW');
 assert.equal(updates,0);assert.equal(JSON.stringify(native),saved);assert.ok(record.payload.lastApplied);
});
test('connector credential is scoped, revocable and private; writes fail closed',()=>{
 const {config,token}=control.newConnector('tenant_a',{environment:'TEST',name:'Test',server:'server',database:'db'});
 assert.equal(config.writeEnabled,false);assert.equal(control.acceptsToken(config,token),true);assert.equal(control.acceptsToken(config,token+'a'),false);
 assert.equal(control.tokenIdentity(token).tenantId,'tenant_a');assert.equal('tokenHash' in control.publicConnector(config),false);
 assert.throws(()=>control.assertWrite(config,{verifiedTest:true,productionAuthorized:true}));
 config.writeEnabled=true;assert.throws(()=>control.assertWrite(config,{verifiedTest:false,productionAuthorized:true}));
 config.environment='PRODUCTION';assert.throws(()=>control.assertWrite(config,{verifiedTest:true,productionAuthorized:false}));
 config.revoked=true;assert.equal(control.acceptsToken(config,token),false);assert.throws(()=>control.assertRead(config));
});
function schema(){return {columns:Object.entries(mapping.sourceTables).flatMap(([table,d])=>d.columns.map(column=>({schema:'dbo',table,column}))),keys:Object.entries(mapping.sourceTables).map(([table,d])=>({schema:'dbo',table,column:d.key,index:'pk',is_unique:true}))};}
test('manifest requires actual unique source keys and rejects unapproved payment fields',()=>{
 const s=schema(),manifest=mapping.readManifest(s),row=Object.fromEntries(manifest.find(x=>x.table==='tblClients').columns.map(k=>[k,null]));row.fldClientID=1;
 assert.equal(mapping.validateBatch(manifest,'tblClients',[row]).key,'fldClientID');
 assert.throws(()=>mapping.validateBatch(manifest,'tblClients',[{...row,fldCCNum:'not-transferable'}]));
 assert.throws(()=>mapping.validateBatch(manifest,'tblClients',[row,row]));
 s.keys=s.keys.filter(k=>k.table!=='tblClients');assert.throws(()=>mapping.readManifest(s));
});
test('profile mappings preserve individual weight description and detect concurrent changes',()=>{
 const p=profiles.profileData('tblPets',{fldName:'Dog',fldWeight:'70 lbs',fldBreed:'Shih Tzu'});assert.equal(p.weightDescription,'70 lbs');assert.equal(p.weightLbs,undefined);
 assert.equal(profiles.conflictingFields({name:'Local'},{name:'Old'},{name:'Source'}).join(','),'name');
 assert.equal(profiles.conflictingFields({name:'Source'},{name:'Old'},{name:'Source'}).length,0);
 assert.equal(profiles.conflictingFields({name:'Old'},{name:'Old'},{name:'Source'}).length,0);
});
test('source phone contacts share normalization and do not invent primary contacts',()=>{
 const phones=profiles.sourcePhones({fldHomePhone:'(555) 123-4567',fldCellPhone:'+1 555 123 4567',fldWorkPhone:'555-222-3333',fldPrimaryPhoneNumber:'5552223333'});
 assert.equal(phones.length,2);assert.equal(phones[0].isPrimary,false);assert.equal(phones[1].isPrimary,true);
 assert.throws(()=>profiles.sourcePhones({fldHomePhone:'123'}));
});
test('redelivered batch is acknowledged once and never deletes a source record',async()=>{
 process.env.GROOMPRO_IMPORT_KEY='ab'.repeat(32);
 const records=new Map();let audits=0;
 const tx={importRecord:{findUnique:async({where})=>records.get(JSON.stringify(where)),upsert:async({where,create,update})=>{const k=JSON.stringify(where);records.set(k,records.has(k)?{...records.get(k),...update}:create)}},auditEntry:{create:async()=>audits++}};
 const manifest=mapping.readManifest(schema()),spec=manifest.find(x=>x.table==='tblPackagesRow'),row=Object.fromEntries(spec.columns.map(k=>[k,null]));row.fldPK=7;
 const message={table:spec.table,rows:[row]};
 assert.equal((await inbox.receiveBatch(tx,'tenant_a','id',schema(),message)).changed,1);
 assert.equal((await inbox.receiveBatch(tx,'tenant_a','id',schema(),message)).unchanged,1);assert.equal(audits,1);assert.equal(records.size,1);
 await inbox.receiveBatch(tx,'tenant_b','id',schema(),message);assert.equal(records.size,2);
 assert.equal(JSON.stringify([...records.values()]).includes('fldPK'),false);
});

test('approved employee links preserve native access and reject cross-business targets',async()=>{
 process.env.GROOMPRO_IMPORT_KEY='ab'.repeat(32);
 const crypto=load('src/lib/import/crypto.ts'),review=load('src/lib/integrations/123pet/review.ts'),catalog=load('src/lib/integrations/123pet/catalog.ts');
 const native={id:'existing',tenantId:'tenant',firstName:'Original',role:'OWNER',pinHash:'unchanged'};
 let saved,audited=0;
 const record={id:'record',entityType:'SOURCE:tblEmployees',payload:{encrypted:crypto.seal({fldFirstName:'Source',fldLastName:'Employee'},'tenant')}};
 const tx={importRecord:{findFirst:async q=>q.where.id?record:null,update:async q=>{saved=q.data}},user:{findFirst:async q=>q.where.tenantId==='tenant'&&q.where.id==='existing'?native:null,update:async()=>{throw Error('Must not modify linked employee')}},auditEntry:{create:async()=>{audited++}}};
 await review.linkReviewedRecord(tx,'tenant','connector','record','existing','owner');
 assert.equal(saved.targetId,'existing');assert.equal(saved.payload.mappingOnly,true);assert.equal(audited,1);
 assert.equal((await catalog.projectCatalog(tx,'tenant','123pet:connector','tblEmployees','1',{fldFirstName:'Source',fldLastName:'Employee'},{targetId:'existing',payload:saved.payload})).state,'APPLIED');
 assert.equal(native.role,'OWNER');assert.equal(native.pinHash,'unchanged');assert.equal(native.firstName,'Original');
 await assert.rejects(()=>review.linkReviewedRecord(tx,'tenant','connector','record','other-business-user','owner'));
});

test('initial setup defaults to tenant import; GroomPro-first is test-only and never enables writes',()=>{
 const input={name:'Test',server:'SQL',database:'DB',environment:'TEST'};
 const normal=control.newConnector('tenant',input).config;
 assert.equal(normal.initialSource,'123PET');assert.equal(normal.readEnabled,true);assert.equal(normal.writeEnabled,false);
 const demo=control.newConnector('tenant',{...input,initialSource:'GROOMPRO_DEMO'}).config;
 assert.equal(demo.readEnabled,false);assert.equal(demo.writeEnabled,false);
 assert.throws(()=>control.newConnector('tenant',{...input,environment:'PRODUCTION',initialSource:'GROOMPRO_DEMO'}));
});
test('cloud demo snapshots retain relationships and exclude employee access and payment identifiers',async()=>{
 process.env.GROOMPRO_IMPORT_KEY='ab'.repeat(32);
 const setup=load('src/lib/integrations/123pet/initial-setup.ts'),crypto=load('src/lib/import/crypto.ts');
 let state,employeeSelection,paymentSelection;const stored=[];
 const rows={customer:[{id:'c',tenantId:'tenant',phones:[]}],pet:[{id:'p',customerId:'c'}],user:[{id:'u',firstName:'Ed',active:true}],service:[],product:[],package:[],ticket:[{id:'t',customerId:'c',locationId:'l',pets:[{petId:'p'}],lines:[{petId:'p',assignedUserId:'u'}],assignments:[{userId:'u'}],payments:[]}],groomingNote:[],location:[{id:'l',name:'Shop',timezone:'America/Chicago'}]};
 const tx={importRecord:{findMany:async()=>[],create:async q=>stored.push(q.data),findUnique:async q=>stored.find(r=>r.sourceId===q.where.tenantId_source_entityType_sourceId.sourceId&&r.tenantId===q.where.tenantId_source_entityType_sourceId.tenantId)},tenantSetting:{upsert:async q=>{state=q.create.value},findUnique:async()=>({value:state})},auditEntry:{create:async()=>{}}};
 for(const [name,data] of Object.entries(rows))tx[name]={findMany:async q=>{assert.equal(q.where.tenantId,'tenant');if(name==='user')employeeSelection=q.select;if(name==='ticket')paymentSelection=q.include.payments.select;return data}};
 const config={id:'connector',tenantId:'tenant',environment:'TEST',initialSource:'GROOMPRO_DEMO',readEnabled:false,revoked:false};
 const result=await setup.prepareDemoSnapshot(tx,config,'owner');
 assert.equal(result.counts.customers,1);assert.equal(result.writesExecuted,0);
 assert.equal(employeeSelection.pinHash,undefined);assert.equal(employeeSelection.role,undefined);assert.equal(paymentSelection.externalId,undefined);
 assert.ok(stored.every(r=>r.payload.encrypted&&!JSON.stringify(r.payload).includes('Ed')));
 const first=await setup.snapshotChunk(tx,config,result.jobId,0);assert.equal(first.kind,'locations');
 await assert.rejects(()=>setup.snapshotChunk(tx,config,'old-job',0));
 await assert.rejects(()=>setup.snapshotChunk(tx,{...config,readEnabled:true},result.jobId,0));
 assert.throws(()=>setup.validateSnapshot({locations:rows.location,customers:rows.customer,pets:[{id:'p',customerId:'other'}],employees:rows.user,tickets:rows.ticket}));
});
