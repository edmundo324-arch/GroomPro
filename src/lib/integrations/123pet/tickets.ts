import {fingerprint,seal,unseal} from '../../import/crypto';
import {nextTicketNumber} from '../../ticket-number';
import {readManifest,validateBatch} from './manifest';
import {mapTicket} from './ticket-mapping';
import {advanceIntegrationRevision} from './revision';

export function validateTicketBundle(schema:any,message:any){
 const manifest=readManifest(schema);
 validateBatch(manifest,'tblTicketsSummary',[message.summary]);
 if(!Array.isArray(message.rows)||message.rows.length>1000)throw Error('Invalid ticket bundle.');
 const ids=new Set<string>();
 for(let i=0;i<message.rows.length;i+=100)validateBatch(manifest,'tblTicketsRow',message.rows.slice(i,i+100));
 for(const row of message.rows){
  if(String(row.fldTicketID)!==String(message.summary.fldTicketID)||ids.has(String(row.fldPK)))throw Error('Ticket bundle contains unrelated or repeated lines.');
  ids.add(String(row.fldPK));
 }
 return {summary:message.summary,rows:[...message.rows].sort((a,b)=>Number(a.fldRowOrder)-Number(b.fldRowOrder)||Number(a.fldPK)-Number(b.fldPK))};
}
const plain=(value:any)=>JSON.parse(JSON.stringify(value));
function snapshot(ticket:any){
 const {lines,pets,payments,...data}=ticket;
 // Exclude only database timestamps; every business-field edit causes review.
 delete data.createdAt;delete data.updatedAt;
 return plain({data,lines:[...lines].sort((a,b)=>a.id.localeCompare(b.id)),pets:[...pets].sort((a,b)=>a.id.localeCompare(b.id)),payments:[...payments].sort((a,b)=>a.id.localeCompare(b.id))});
}

// Caller holds the tenant lock. Never deletes lines, pets, payments or tickets.
// Financial/source-line corrections remain staged for explicit reconciliation.
export async function receiveTicketBundle(tx:any,tenantId:string,connectorId:string,schema:any,message:any){
 const bundle=validateTicketBundle(schema,message),source='123pet:'+connectorId,sourceId=String(bundle.summary.fldPK),entityType='TICKET_BUNDLE';
 const where={tenantId_source_entityType_sourceId:{tenantId,source,entityType,sourceId}};
 const previous=await tx.importRecord.findUnique({where}),hash=fingerprint(bundle);
 if(previous?.payload?.fingerprint===hash&&previous.payload.state==='APPLIED')return {changed:0,unchanged:1};
 const payload:any={encrypted:seal(bundle,tenantId),fingerprint:hash,receivedAt:new Date().toISOString(),state:'REVIEW',reason:''};
 let targetId=previous?.targetId??null;
 let mutating=false;
 const locations=await tx.location.findMany({where:{tenantId}});
 try{
  if(locations.length!==1)throw Error('Choose an explicit destination location before projecting tickets.');
  const links=await tx.importRecord.findMany({where:{tenantId,source,entityType:{in:['SOURCE:tblClients','SOURCE:tblPets','SOURCE:tblEmployees','SOURCE:tblProductsAndServices']}}});
  const lookup=new Map<string,string|null>();
  for(const link of links){
   if(!link.targetId)continue;
   const row=unseal(link.payload.encrypted,tenantId) as any;
   const key=link.entityType==='SOURCE:tblProductsAndServices'?'SOURCE:catalog:'+row.fldPS+':'+String(row.fldID):link.entityType+':'+String(link.entityType==='SOURCE:tblEmployees'?row.fldEmployeeID:link.sourceId);
   lookup.set(key,lookup.has(key)?null:link.targetId);
  }
  const mapped=mapTicket(bundle.summary,bundle.rows,locations[0].timezone,(table,id)=>lookup.get('SOURCE:'+table+':'+String(id))??null);
  for(const petId of mapped.petIds)if(!await tx.pet.findFirst({where:{id:petId,tenantId,customerId:mapped.data.customerId}}))throw Error('A ticket pet does not belong to the source customer.');
  const id=targetId||'sync_'+fingerprint([tenantId,source,entityType,sourceId]).slice(0,40);
  const include={lines:true,pets:true,payments:true};
  const current=await tx.ticket.findFirst({where:{id,tenantId},include});
  if(targetId&&!current)throw Error('The linked GroomPro ticket was removed.');
  if(current){
   if(!previous?.payload?.nativeSnapshot||fingerprint(snapshot(current))!==fingerprint(unseal(previous.payload.nativeSnapshot,tenantId)))throw Error('GroomPro changed this ticket; review both versions before applying source changes.');
   const old=unseal(previous.payload.lastApplied||previous.payload.encrypted,tenantId) as any;
   if(current.customerId!==mapped.data.customerId)throw Error('Changing a ticket customer requires ownership review.');
   const oldKeys=new Set(old.rows.map((r:any)=>String(r.fldPK))),newKeys=new Set(bundle.rows.map((r:any)=>String(r.fldPK)));
   if([...oldKeys].some(key=>!newKeys.has(key as string)))throw Error('A source line was removed; retain the original until reviewed.');
   if(current.pets.some((pet:any)=>!mapped.petIds.includes(pet.petId)))throw Error('Removing a ticket pet requires review.');
   const financialKeys=['fldSubtotal','fldTotal','fldTax1','fldTax2','fldTax3','fldTip'];
   const changedMoney=financialKeys.some(k=>old.summary[k]!==bundle.summary[k])||old.rows.some((r:any)=>{const next=bundle.rows.find((n:any)=>String(n.fldPK)===String(r.fldPK));return ['fldQuantity','fldPrice','fldRowTotal'].some(k=>r[k]!==next[k])})||oldKeys.size!==newKeys.size;
   if((current.payments.length||current.status==='CLOSED')&&changedMoney)throw Error('Financial corrections on a paid ticket require review.');
   if(current.payments.length&&['fldTender1','fldTender2','fldPayType1','fldPayType2','fldChange','fldDateClosed','fldTimeClosed'].some(k=>old.summary[k]!==bundle.summary[k]))throw Error('Source payment details changed; retain the original until reviewed.');
   for(const payment of current.payments){
    const incoming=mapped.payments.find(p=>payment.externalId===source+':'+sourceId+':'+p.sourceIndex);
    if(!incoming||Number(payment.amount)!==Number(incoming.amount)||payment.paymentType!==incoming.paymentType||+new Date(payment.paidAt)!==+incoming.paidAt)throw Error('A recorded payment changed; retain the original until reviewed.');
   }
   if(current.status==='CLOSED'&&mapped.data.status!=='CLOSED')throw Error('Reopening a closed source ticket requires review.');
   if(current.status==='CANCELLED'&&mapped.data.status!=='CANCELLED')throw Error('Restoring a voided source ticket requires review.');
   // Every validation precedes mutation. This transaction only adds or updates;
   // existing payment rows are immutable and source removals are never applied.
   mutating=true;
   for(const line of mapped.lines){
    const data={...line.data,sourceKey:source+':'+line.sourcePk};
    const existing=current.lines.find((l:any)=>l.sourceKey===data.sourceKey);
    if(existing)await tx.ticketLine.update({where:{id:existing.id},data});
    else await tx.ticketLine.create({data:{...data,ticketId:id}});
   }
   for(const petId of mapped.petIds)if(!current.pets.some((p:any)=>p.petId===petId))await tx.ticketPet.create({data:{ticketId:id,petId}});
   for(const {sourceIndex,...payment} of mapped.payments){const externalId=source+':'+sourceId+':'+sourceIndex;if(!current.payments.some((p:any)=>p.externalId===externalId))await tx.payment.create({data:{...payment,tenantId,ticketId:id,externalId}});}
   await tx.ticket.update({where:{id},data:mapped.data});
  }else{
   mutating=true;
   await tx.ticket.create({data:{id,tenantId,locationId:locations[0].id,orderNumber:await nextTicketNumber(tx,tenantId),...mapped.data,
    lines:{create:mapped.lines.map(line=>({...line.data,sourceKey:source+':'+line.sourcePk}))},
    pets:{create:mapped.petIds.map(petId=>({petId}))},
    payments:{create:mapped.payments.map(({sourceIndex,...payment})=>({...payment,tenantId,externalId:source+':'+sourceId+':'+sourceIndex}))}}});
  }
  targetId=id;payload.state='APPLIED';delete payload.reason;
  payload.nativeSnapshot=seal(snapshot(await tx.ticket.findFirst({where:{id,tenantId},include})),tenantId);
  await advanceIntegrationRevision(tx,tenantId);
 }catch(e){
  // Database failures must roll the entire request back, not commit partial work.
  if(mutating||(e as any).code||String((e as any).name).startsWith('Prisma'))throw e;
  payload.reason=(e as Error).message;
  if(previous?.payload?.nativeSnapshot)payload.nativeSnapshot=previous.payload.nativeSnapshot;
 }
 // Retain the last applied source version separately while a correction awaits review.
 if(payload.state!=='APPLIED'&&previous?.payload?.state==='APPLIED')payload.lastApplied=previous.payload.encrypted;
 else if(payload.state!=='APPLIED'&&previous?.payload?.lastApplied)payload.lastApplied=previous.payload.lastApplied;
 await tx.importRecord.upsert({where,create:{tenantId,source,entityType,sourceId,targetId,payload},update:{targetId,payload}});
 if(previous?.payload?.fingerprint!==hash||previous?.payload?.state!==payload.state)await tx.auditEntry.create({data:{tenantId,actorType:'SYSTEM',entityType:'TENANT',entityId:connectorId,action:'SOURCE_TICKET_RECEIVED',summary:payload.state==='APPLIED'?'123Pet ticket synchronized.':'123Pet ticket retained for review.',details:{sourceId,targetId,state:payload.state,reason:payload.reason??null}}});
 return {changed:1,unchanged:0,state:payload.state};
}
