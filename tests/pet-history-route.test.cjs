const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,deps){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{if(!(name in deps))throw Error(name);return deps[name]},exports);return exports;}
const response={json:(data,options)=>({data,status:options?.status||200})};
test('pet ticket history follows pet links across owners and paginates without dropping older tickets',async()=>{
 let query;const db={pet:{findFirst:async()=>({id:'dog',customerId:'new-family'})},ticket:{findMany:async args=>{query=args;return Array.from({length:51},(_,i)=>({id:'ticket'+i,customer:{firstName:i?'Previous':'Current'}}))}}};
 const {GET}=load('app/api/pets/history/route.ts',{'next/server':{NextResponse:response},'@/src/lib/db':{db},'@/src/lib/request-policy':{withRequestPolicy:f=>f}});
 const r={headers:{get:()=> 'shop'},nextUrl:new URL('http://test/api/pets/history?petId=dog&after=older-page')};const out=await GET(r);
 assert.equal(query.where.tenantId,'shop');assert.equal(query.where.customerId,undefined);assert.deepEqual(query.where.OR,[{pets:{some:{petId:'dog'}}},{lines:{some:{petId:'dog'}}}]);assert.deepEqual(query.cursor,{id:'older-page'});assert.equal(query.skip,1);assert.equal(out.data.tickets.length,50);assert.equal(out.data.next,'ticket49');
 db.pet.findFirst=async()=>null;assert.equal((await GET(r)).status,404);
});
test('grooming history includes current pet notes from a previous customer without reassigning them',async()=>{
 let noteQuery,ticketQuery;const note={id:'note',petId:'dog',ticketId:'old-ticket',customerId:'old-family',appointmentAt:new Date('2020-01-01'),lockedAt:new Date('2020-01-02'),instructions:{body:'Long'},usual:false};
 const tx={customer:{findFirst:async()=>({id:'new-family',notes:''})},pet:{findMany:async()=>[{id:'dog',name:'Gizmo'}]},groomingNote:{findMany:async q=>{noteQuery=q;return[note]}},ticket:{findMany:async q=>{ticketQuery=q;return[{id:'old-ticket',scheduledStart:note.appointmentAt,orderNumber:1,status:'CLOSED',lines:[{petId:'dog'}]}]}}};
 const db={$transaction:fn=>fn(tx)};
 const deps={'next/server':{NextResponse:response},'@/src/lib/db':{db},'@/src/lib/request-policy':{withRequestPolicy:f=>f},'@/src/lib/operating-hours':{},'@/src/lib/customer-notes':{combinedCustomerNotes:c=>c.notes},'@/src/lib/import/grooming-comments':{importedGroomingHistory:()=>[]},'@/src/lib/appointment-pets':{},'@/src/lib/employee-session':{},'@/src/lib/grooming-notes-store':{freezeNote:async(t,n)=>n},'@/src/lib/grooming-note-defaults':{initialGroomingInstructions:()=>({})},'@/src/lib/grooming-notes-rules':{},'@/src/lib/breed-store':{loadBreeds:async()=>[]}};
 const {GET}=load('app/api/grooming-notes/route.ts',deps);const out=await GET({headers:{get:()=> 'shop'},nextUrl:new URL('http://test/api/grooming-notes?customerId=new-family')});
 assert.equal(out.status,200);assert.deepEqual(noteQuery.where.OR,[{customerId:'new-family'},{petId:{in:['dog']}}]);assert.equal(ticketQuery.where.customerId,undefined);assert.equal(out.data.records[0].customerId,'old-family');assert.equal(out.data.records[0].ticketId,'old-ticket');
});
