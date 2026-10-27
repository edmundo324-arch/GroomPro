import {fingerprint,seal,unseal} from '../../import/crypto';
import {ConnectorConfig} from './control';
import {randomUUID} from 'node:crypto';
const key=(id:string)=>'123PET_INITIAL_SETUP:'+id;
export function assertDemoSource(config:ConnectorConfig){
 if(config.revoked||config.environment!=='TEST'||config.initialSource!=='GROOMPRO_DEMO')throw Error('Choose GroomPro as the initial source on a Test connection.');
 if(config.readEnabled)throw Error('Pause incoming updates before preparing the GroomPro demo.');
}
// A consistent snapshot is taken from the server running this code: on GoDaddy,
// this is GoDaddy's database. There is no localhost or bundled-fixture fallback.
export async function prepareDemoSnapshot(tx:any,config:ConnectorConfig,actorId:string){
 assertDemoSource(config);
 const tenantId=config.tenantId,source='123pet:'+config.id;
 const received=await tx.importRecord.findMany({where:{tenantId,source:{startsWith:'123pet:'}},select:{targetId:true,payload:true}});
 const excluded=received.filter((r:any)=>r.targetId&&!r.payload?.mappingOnly).map((r:any)=>r.targetId);
 const where={tenantId,id:{notIn:excluded}};
 const customers=await tx.customer.findMany({where,include:{phones:true},orderBy:{id:'asc'}});
 const pets=await tx.pet.findMany({where,include:{vaccinations:true},orderBy:{id:'asc'}});
 // Explicit selection prevents PIN hashes, recoverable PINs, tokens and roles
 // from crossing into 123Pet. Production staff access is never copied.
 const employees=await tx.user.findMany({where,select:{id:true,firstName:true,lastName:true,displayName:true,jobTitle:true,active:true},orderBy:{id:'asc'}});
 const services=await tx.service.findMany({where,orderBy:{id:'asc'}});
 const products=await tx.product.findMany({where,orderBy:{id:'asc'}});
 const packages=await tx.package.findMany({where,include:{items:{orderBy:{sortOrder:'asc'}}},orderBy:{id:'asc'}});
 const tickets=await tx.ticket.findMany({where,include:{pets:true,lines:{orderBy:{sortOrder:'asc'}},assignments:true,scheduleHistory:true,payments:{select:{id:true,amount:true,paymentType:true,paidAt:true}}},orderBy:{id:'asc'}});
 const groomingNotes=await tx.groomingNote.findMany({where:{tenantId,ticketId:{in:tickets.map((t:any)=>t.id)}},orderBy:{id:'asc'}});
 const locations=await tx.location.findMany({where:{tenantId},select:{id:true,name:true,timezone:true}});
 const records={locations,customers,pets,employees,services,products,packages,tickets,groomingNotes};
 validateSnapshot(records);
 const jobId=randomUUID(),counts=Object.fromEntries(Object.entries(records).map(([name,rows])=>[name,rows.length]));
 const chunks:{kind:string;rows:any[]}[]=[];
 for(const [kind,rows] of Object.entries(records))for(let i=0;i<rows.length;i+=25)chunks.push({kind,rows:rows.slice(i,i+25)});
 for(let i=0;i<chunks.length;i++)await tx.importRecord.create({data:{tenantId,source,entityType:'OUTBOUND_SNAPSHOT',sourceId:jobId+':'+i,payload:{encrypted:seal(chunks[i],tenantId),fingerprint:fingerprint(chunks[i]),state:'PREPARED'}}});
 const state={jobId,state:'PREPARED',counts,chunks:chunks.length,preparedAt:new Date().toISOString(),preparedBy:actorId,source:'THIS_GROOMPRO_SERVER',writesExecuted:0};
 await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey:key(config.id)}},create:{tenantId,settingKey:key(config.id),value:state},update:{value:state}});
 await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:actorId,entityType:'TENANT',entityId:config.id,action:'123PET_DEMO_PREPARED',summary:'Prepared this GroomPro server’s demo records for 123Pet compatibility review; no source writes.',details:{jobId,counts}}});
 return state;
}
export function validateSnapshot(data:any){
 const ids=(kind:string)=>new Set<string>(data[kind].map((r:any)=>r.id));
 const customers=ids('customers'),pets=ids('pets'),employees=ids('employees'),locations=ids('locations');
 const owners=new Map<string,string>(data.pets.map((p:any)=>[p.id,p.customerId]));
 for(const p of data.pets)if(!customers.has(p.customerId))throw Error('A pet owner is outside the selected source records.');
 for(const t of data.tickets){
  if(!customers.has(t.customerId)||!locations.has(t.locationId))throw Error('A ticket customer or location is missing.');
  for(const p of t.pets)if(!pets.has(p.petId)||owners.get(p.petId)!==t.customerId)throw Error('A ticket pet belongs to a different customer.');
  for(const l of t.lines){
   if(l.petId&&owners.get(l.petId)!==t.customerId)throw Error('A ticket line has a mismatched pet.');
   if(l.assignedUserId&&!employees.has(l.assignedUserId))throw Error('A ticket employee is missing.');
  }
  for(const a of t.assignments)if(!employees.has(a.userId))throw Error('A production employee is missing.');
 }
}
export async function initialSetupStatus(tx:any,config:ConnectorConfig){
 return (await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:config.tenantId,settingKey:key(config.id)}}}))?.value??null;
}
export async function snapshotChunk(tx:any,config:ConnectorConfig,jobId:string,index:number){
 assertDemoSource(config);
 const state=await initialSetupStatus(tx,config);
 if(!state||state.jobId!==jobId||!Number.isSafeInteger(index)||index<0||index>=state.chunks)throw Error('Choose a chunk from the current initial setup.');
 const row=await tx.importRecord.findUnique({where:{tenantId_source_entityType_sourceId:{tenantId:config.tenantId,source:'123pet:'+config.id,entityType:'OUTBOUND_SNAPSHOT',sourceId:jobId+':'+index}}});
 if(!row)throw Error('Snapshot chunk is missing. Prepare the snapshot again.');
 return {jobId,index,total:state.chunks,fingerprint:row.payload.fingerprint,...unseal(row.payload.encrypted,config.tenantId)};
}
