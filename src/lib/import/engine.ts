import {appointmentData,appointmentInclude,insertAppointment} from './appointments';
import {petBreedData} from '../breed-classification';
import {loadBreeds} from '../breed-store';
import {localToInstant} from '../operating-hours';
import {randomUUID} from 'node:crypto';
import {Dataset,Entity,definitions,convert,sensitive} from './fields';
import {fingerprint,seal,unseal} from './crypto';
const models:Record<string,string>={CUSTOMER:'customer',PET:'pet',EMPLOYEE:'user',SERVICE:'service',APPOINTMENT:'ticket'};
const rank:Record<Entity,number>={EMPLOYEE:0,CUSTOMER:1,PET:2,SERVICE:3,APPOINTMENT:4,HISTORY:5};
const present=(v:unknown)=>v!==null&&v!==undefined&&v!=='';
export type Issue={dataset:string;row?:number;field?:string;message:string};
function converted(value:unknown,f:any,d:Dataset){
 if(['date','datetime'].includes(f.kind)&&present(value)&&d.dateFormat==='MDY'){
  const m=String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{1,2}):(\d{2})(?::(\d{2}))? ?(AM|PM)?)?$/i);
  if(m){const date=m[3]+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');convert(date,{...f,kind:'date'});if(m[4]){if(!d.sourceTimezone)throw Error('Choose the source timezone for timestamps.');let hour=Number(m[4]);if(m[7])hour=hour%12+(m[7].toUpperCase()==='PM'?12:0);if(hour>23||Number(m[5])>59||Number(m[6]||0)>59)throw Error('Invalid time.');return new Date(+localToInstant(date+'T'+String(hour).padStart(2,'0')+':'+m[5],d.sourceTimezone)+Number(m[6]||0)*1000);}return convert(date,f);}
 }
 if(f.kind==='datetime'&&typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)){if(!d.sourceTimezone)throw Error('Choose a source timezone.');return localToInstant(value,d.sourceTimezone);}
 return convert(value,f);
}
export function inventory(datasets:Dataset[]){return datasets.flatMap(d=>d.headers.map(h=>{const m=d.mapping[h],def=Object.hasOwn(definitions[d.entity]||{},m)?definitions[d.entity][m]:undefined;return {dataset:d.name,sourceColumn:h,entity:d.entity,destination:def?`${models[d.entity]||"ImportRecord.relationships"}.${def.target}`:m==='SECURE'?'Encrypted source record':m==='LEGACY'?'Linked historical source record':'UNRESOLVED',disposition:def?'OPERATIONAL':m==='SECURE'?'SECURE':m==='LEGACY'?'HISTORICAL':'UNRESOLVED',observedTypes:[...new Set(d.rows.map(r=>r[h]===null?'null':typeof r[h]))],nonempty:d.rows.filter(r=>present(r[h])).length,empty:d.rows.filter(r=>!present(r[h])).length,examples:(sensitive(h)||m==='SECURE')?['[protected]']:[...new Set(d.rows.map(r=>r[h]).filter(present).map(v=>typeof v==='object'?'[structured value]':String(v)))].slice(0,3).map(s=>s.slice(0,120)),transformation:def?.kind||'Exact original value; no operational meaning inferred',retained:0,failures:0};}));}
export function validateDatasets(datasets:Dataset[]){
 const issues:Issue[]=[];const allIds=new Set<string>();if(!Array.isArray(datasets)||!datasets.length||datasets.length>100)throw Error('Choose 1-100 datasets.');
 if(new Set(datasets.map(d=>d.name)).size!==datasets.length)throw Error('Dataset names must be unique.');
 if(datasets.reduce((n,d)=>n+d.rows.length,0)>50000)throw Error('Split migrations larger than 50,000 records.');
 for(const d of datasets){if(!Object.hasOwn(definitions,d.entity)||!Array.isArray(d.headers)||!Array.isArray(d.rows))throw Error('Invalid dataset.');if(new Set(d.headers).size!==d.headers.length)throw Error('Duplicate headers.');
 const seen=new Set<string>();const targets=new Set<string>();
 for(const h of d.headers){const m=d.mapping[h];const def=Object.hasOwn(definitions[d.entity],m)?definitions[d.entity][m]:undefined;if(!def&&!['LEGACY','SECURE'].includes(m))issues.push({dataset:d.name,field:h,message:'Choose an operational field or explicitly retain this column as historical.'});if(sensitive(h)&&m!=='SECURE')issues.push({dataset:d.name,field:h,message:'Protected columns must use encrypted source storage.'});if(def){if(targets.has(def.target))issues.push({dataset:d.name,field:h,message:'Multiple columns target the same field; retain one original as historical or resolve the mapping.'});targets.add(def.target);}}
 if(!d.idColumn||!d.headers.includes(d.idColumn)||sensitive(d.idColumn))issues.push({dataset:d.name,message:'Select a stable source identifier. Names and row numbers are not identifiers.'});
 for(const [i,row] of d.rows.entries()){if(Object.keys(row).some(k=>!d.headers.includes(k)))issues.push({dataset:d.name,row:i+2,message:'Record contains a field missing from the inventory.'});const id=String(row[d.idColumn]??'');if(!id||id.length>191||seen.has(id))issues.push({dataset:d.name,row:i+2,field:d.idColumn,message:'Missing, duplicate, or oversized stable source identifier.'});if(allIds.has(d.entity+':'+id))issues.push({dataset:d.name,row:i+2,field:d.idColumn,message:'Duplicate identifier across selected datasets.'});allIds.add(d.entity+':'+id);seen.add(id);
 for(const h of d.headers){const def=Object.hasOwn(definitions[d.entity],d.mapping[h])?definitions[d.entity][d.mapping[h]]:undefined;if(def)try{converted(row[h],def,d);}catch(e){issues.push({dataset:d.name,row:i+2,field:h,message:(e as Error).message});}}
 }
 }
 return issues;
}
type Plan={dataset:string;row:number;entity:Entity;sourceId:string;targetId:string|null;action:string;data:any;phones:any[];raw:any;existing:any;record:any;changes:string[]};
export async function planImport(client:any,tenantId:string,source:string,datasets:Dataset[],mode:string){
 if(!['NEW','MATCH','UPDATE'].includes(mode))throw Error('Choose new records, match only, or reviewed updates.');
 const issues=validateDatasets(datasets),fields=inventory(datasets),plans:Plan[]=[];
 if(issues.length)return {issues,fields,plans,totals:{examined:datasets.reduce((n,d)=>n+d.rows.length,0)}};
 const breeds=await loadBreeds(client,tenantId);
 const old=await client.importRecord.findMany({where:{tenantId,source}});const links=new Map(old.map((r:any)=>[r.entityType+':'+r.sourceId,r]));
 const entities:any={};for(const [entity,model] of Object.entries(models))entities[entity]=entity==='APPOINTMENT'&&!datasets.some(d=>d.entity==='APPOINTMENT')?[]:await client[model].findMany({where:{tenantId},...(entity==='CUSTOMER'?{include:{phones:true}}:entity==='APPOINTMENT'?{include:appointmentInclude}:{})});
 const ids=new Map<string,string>();for(const r of old)if(r.targetId)ids.set(r.entityType+':'+r.sourceId,r.targetId);
 for(const d of [...datasets].sort((a,b)=>rank[a.entity]-rank[b.entity]))for(const [index,row] of d.rows.entries()){
  const sourceId=String(row[d.idColumn]),key=d.entity+':'+sourceId,record:any=links.get(key);let existing=record?.targetId?entities[d.entity]?.find((r:any)=>r.id===record.targetId):null;
  if(d.matches?.[sourceId]){existing=entities[d.entity]?.find((r:any)=>r.id===d.matches![sourceId]);if(!existing){issues.push({dataset:d.name,row:index+2,message:'Selected match does not belong to this entity and tenant.'});continue;}}
  if(record?.targetId&&!existing&&d.entity!=='HISTORY'){issues.push({dataset:d.name,row:index+2,message:'Previously linked record no longer exists. Review before reimport.'});continue;}
  // Only stable identifiers are automatic matches. Email, phone and names are conflict detectors.
  if(!existing&&d.entity!=='HISTORY'){const matches=entities[d.entity].filter((r:any)=>r.id===sourceId||r.importSourceId===sourceId||(d.entity==='SERVICE'&&r.code&&r.code===row.ID));if(matches.length>1){issues.push({dataset:d.name,row:index+2,message:'Source identifier matches multiple records.'});continue;}existing=matches[0]||null;}
  const data:any={},phones:any[]=[];for(const h of d.headers){const def=Object.hasOwn(definitions[d.entity],d.mapping[h])?definitions[d.entity][d.mapping[h]]:undefined;if(!def)continue;let value=converted(row[h],def,d);if(value===null)continue;if(def.kind==='phone'){const number=String(value),normalized=number.replace(/\D/g,'').replace(/^1(?=\d{10}$)/,'');if(normalized.length<7||normalized.length>15){issues.push({dataset:d.name,row:index+2,field:h,message:'Phone cannot be normalized safely.'});continue;}if(!phones.some(p=>p.normalized===normalized))phones.push({number,normalized,label:def.target.split(':')[1],isPrimary:def.target==='phone:Primary',smsEnabled:false,callEnabled:false});}else if(def.kind==='relation'){const relation=def.target==='customerId'?'CUSTOMER':def.target==='petId'?'PET':'EMPLOYEE';value=ids.get(relation+':'+String(value))||entities[relation].find((r:any)=>r.importSourceId===String(value)||r.id===String(value))?.id;if(!value)issues.push({dataset:d.name,row:index+2,field:h,message:'Unresolved '+relation.toLowerCase()+' identifier. Include or import the related dataset first.'});else if(def.target.includes(':')){const [group,key]=def.target.split(':');data[group]={...(data[group]||{}),[key]:value};}else data[def.target]=value;}else if(def.target.includes(':')){const [group,key]=def.target.split(':');data[group]={...(data[group]||{}),[key]:value};}else data[def.target]=value;}
  if(d.entity==='APPOINTMENT'){try{const resolve=(entity:string,id:string)=>{const linked=ids.get(entity+':'+id);const p=plans.find(p=>p.entity===entity&&p.action!=='SKIP'&&(p.targetId===id||p.targetId===linked||p.sourceId===id));return p?{...p.existing,...p.data,id:p.targetId}:entities[entity]?.find((r:any)=>r.id===id||r.id===linked||r.importSourceId===id||(entity==='SERVICE'&&r.code===id))};const prepared=appointmentData(data,d.locationId,resolve);for(const k of Object.keys(data))delete data[k];Object.assign(data,prepared);if(existing&&mode==='UPDATE')throw Error('Existing appointments are matched without overwriting subsequent ticket activity. Use New records / Match mode.');}catch(e){issues.push({dataset:d.name,row:index+2,message:(e as Error).message});}}
  if(d.entity==='PET'&&data.breed!==undefined)Object.assign(data,petBreedData(data,breeds,existing||{}));
  if(existing)for(const field of ['careFlags','certifications','taxConfiguration','onlineBookingDays','inventoryDetails','sourceCommission'])if(data[field]&&typeof data[field]==='object'&&!Array.isArray(data[field]))data[field]={...(existing[field]||{}),...data[field]};
  if(d.entity==='PET'){if(d.mapping.Dead==='Dead'&&present(row.Dead)){try{if(convert(row.Dead,{target:'active',kind:'bool'}))data.active=false;}catch{issues.push({dataset:d.name,row:index+2,field:'Dead',message:'Inactive status needs review.'});}}}
  if(d.entity==='EMPLOYEE'){if(!existing){data.active=false;data.pinHash='IMPORT_DISABLED';data.role='FRONT';}}

  if(!existing&&d.entity!=='HISTORY'){const required=d.entity==='CUSTOMER'||d.entity==='EMPLOYEE'?[]:d.entity==='PET'?['name','customerId']:d.entity==='APPOINTMENT'?['customerId','scheduledStart','locationId']:['name','code','priceCents'];if(['CUSTOMER','EMPLOYEE'].includes(d.entity)){if(!data.firstName&&!data.lastName)issues.push({dataset:d.name,row:index+2,message:'At least one name is required.'});data.firstName??='';data.lastName??='';}for(const f of required)if(data[f]===undefined||data[f]==='')issues.push({dataset:d.name,row:index+2,field:f,message:'Required operational value missing; map it or retain the record as history.'});
   const collision=entities[d.entity].some((r:any)=>data.email&&r.email===data.email||(d.entity==='CUSTOMER'&&r.phones?.some((p:any)=>phones.some(v=>v.normalized===p.normalized))));if(collision)issues.push({dataset:d.name,row:index+2,message:'Contact matches an existing record without a stable source link. No automatic merge; review the source identifier.'});}
  if(existing&&data.customerId&&existing.customerId!==data.customerId)issues.push({dataset:d.name,row:index+2,message:'Source owner differs from the existing pet owner. Ownership will not be changed by import.'});
  const targetId=existing?.id||(d.entity==='HISTORY'?(data.customerId||null):'imp_'+fingerprint([tenantId,source,d.entity,sourceId]).slice(0,40));if(targetId)ids.set(key,targetId);
  const changes=existing?Object.keys(data).filter(k=>JSON.stringify(existing[k])!==JSON.stringify(data[k])):Object.keys(data);
  const action=existing?(mode==='UPDATE'?'UPDATE':'MATCH'):mode==='MATCH'?'SKIP':'INSERT';
  if(action==='SKIP'&&targetId)ids.delete(key);
  plans.push({dataset:d.name,row:index+2,entity:d.entity,sourceId,targetId,action,data,phones,raw:row,existing,record,changes});
 }
 // Detect contact collisions within the migration as well as the current database.
 const contactOwners=new Map<string,string>();for(const c of entities.CUSTOMER)for(const p of c.phones)contactOwners.set(p.normalized,c.id);
 for(const p of plans)for(const phone of p.phones){const owner=contactOwners.get(phone.normalized);if(owner&&owner!==p.targetId)issues.push({dataset:p.dataset,row:p.row,message:'Phone belongs to another customer in this migration or database.'});else contactOwners.set(phone.normalized,p.targetId!);}
 const updateTargets=new Set<string>();for(const p of plans)if(p.action==='UPDATE'){const key=p.entity+':'+p.targetId;if(updateTargets.has(key))issues.push({dataset:p.dataset,row:p.row,message:'Multiple source records would update the same record. Resolve the matches before importing.'});updateTargets.add(key);}
 const emails=new Map<string,string>(entities.EMPLOYEE.filter((e:any)=>e.email).map((e:any)=>[String(e.email).trim().toLowerCase(),e.id]));for(const p of plans)if(p.entity==='EMPLOYEE'&&p.data.email&&p.action!=='SKIP'){const key=String(p.data.email).trim().toLowerCase();if(emails.has(key)&&emails.get(key)!==p.targetId)issues.push({dataset:p.dataset,row:p.row,field:'E-mail',message:'Employee email is shared by multiple source identifiers; resolve the match or retain this field historically.'});else emails.set(key,p.targetId!);}
 for(const p of plans)if(p.entity==='PET'&&p.action!=='SKIP'&&!entities.CUSTOMER.some((c:any)=>c.id===p.data.customerId)&&!plans.some(c=>c.entity==='CUSTOMER'&&c.targetId===p.data.customerId&&c.action!=='SKIP'))issues.push({dataset:p.dataset,row:p.row,message:'Owner is not available in the selected import mode.'});
 for(const f of fields)f.failures=issues.filter(i=>i.dataset===f.dataset&&i.field===f.sourceColumn).length;
 return {issues,fields,plans,totals:{examined:plans.length,inserted:plans.filter(p=>p.action==='INSERT').length,updated:plans.filter(p=>p.action==='UPDATE').length,matched:plans.filter(p=>p.action==='MATCH').length,skipped:plans.filter(p=>p.action==='SKIP').length}};
}
export function publicReport(plan:Awaited<ReturnType<typeof planImport>>){return {fields:plan.fields,issues:plan.issues,totals:plan.totals,records:plan.plans.map(p=>({dataset:p.dataset,row:p.row,sourceId:p.sourceId,action:p.action,targetId:p.targetId,changedFields:p.changes,changes:Object.fromEntries(p.changes.filter(k=>!sensitive(k)&&k!=='pinHash').map(k=>[k,{before:p.existing?.[k]??null,after:p.data[k]}])),financialReview:Object.keys(p.raw).filter(h=>/balance|discount|qnt|loyalty|tip|prepaid/i.test(h))})),notice:'All originals are retained encrypted. Source balances, discounts, prepaid quantities and credentials are historical until explicitly reconciled. Imported employees cannot sign in until a manager assigns a PIN. No payment credentials are activated.'};}
export async function executeImport(db:any,tenantId:string,jobId:string){return db.$transaction(async(tx:any)=>{
 await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
 const job=await tx.importJob.findFirst({where:{id:jobId,tenantId}});if(!job)throw Error('Import not found.');if(job.status==='COMPLETED')return job.report;if(job.status!=='VALIDATED')throw Error('Validate this migration before executing.');
 const datasets=unseal(job.encryptedData,tenantId) as Dataset[];const plan=await planImport(tx,tenantId,job.source,datasets.filter(d=>d.selected!==false),job.mode);if(plan.issues.length)throw Error('Data changed since validation. Validate again and review conflicts.');
 const review=fingerprint(publicReport(plan));if(review!==job.fingerprint)throw Error('Proposed changes have changed since validation. Validate again.');
 for(const p of plan.plans){if(p.action==='SKIP')continue;
  const model=models[p.entity];let after:any=null;
  if(p.entity==='APPOINTMENT'&&p.action==='INSERT'){after=await insertAppointment(tx,tenantId,p.targetId!,p.data);}
  if(model&&p.entity!=='APPOINTMENT'&&p.action==='INSERT'){after=await tx[model].create({data:{...p.data,id:p.targetId,tenantId}});}
  if(model&&p.action==='UPDATE'){after=await tx[model].update({where:{id:p.targetId},data:p.data});}
  if(model&&p.entity==='CUSTOMER'&&['INSERT','UPDATE'].includes(p.action))for(const phone of p.phones){if(!p.existing?.phones?.some((v:any)=>v.normalized===phone.normalized))await tx.customerPhone.create({data:{...phone,id:randomUUID(),tenantId,customerId:p.targetId,isPrimary:!p.existing?.phones?.length&&phone===p.phones[0]}});}
  if(after){const snapshot=await tx[model].findFirst({where:{id:p.targetId,tenantId},...(p.entity==='CUSTOMER'?{include:{phones:true}}:p.entity==='APPOINTMENT'?{include:appointmentInclude}:{})});await tx.importChange.create({data:{tenantId,jobId,entityType:p.entity,targetId:p.targetId,encryptedBefore:seal({record:p.existing,link:p.record||null},tenantId),encryptedAfter:seal(snapshot,tenantId)}});}
  const payload={encrypted:seal(p.raw,tenantId),jobId,dataset:p.dataset,fields:Object.keys(p.raw),relationships:p.entity==='HISTORY'?p.data:{}};
  await tx.importRecord.upsert({where:{tenantId_source_entityType_sourceId:{tenantId,source:job.source,entityType:p.entity,sourceId:p.sourceId}},create:{tenantId,source:job.source,entityType:p.entity,sourceId:p.sourceId,targetId:p.targetId,payload},update:{targetId:p.targetId,payload}});
 }
 const report=publicReport(plan);for(const f of report.fields)f.retained=plan.plans.filter(p=>p.dataset===f.dataset&&p.action!=='SKIP').length;
 await tx.importJob.update({where:{id:jobId},data:{status:'COMPLETED',report,completedAt:new Date()}});
 return report;
 },{timeout:240000,maxWait:15000});}

export async function rollbackImport(db:any,tenantId:string,jobId:string){return db.$transaction(async(tx:any)=>{
 await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
 const job=await tx.importJob.findFirst({where:{id:jobId,tenantId}});if(!job||job.status!=='COMPLETED')throw Error('Only a completed import can be rolled back.');
 const changes=await tx.importChange.findMany({where:{tenantId,jobId},orderBy:{createdAt:'desc'}});
 // Refuse rollback once any imported record has been edited or used elsewhere.
 for(const change of changes){const model=models[change.entityType];const current=await tx[model].findFirst({where:{id:change.targetId,tenantId},...(change.entityType==='CUSTOMER'?{include:{phones:true}}:change.entityType==='APPOINTMENT'?{include:appointmentInclude}:{})});if(fingerprint(current)!==fingerprint(unseal(change.encryptedAfter,tenantId)))throw Error('An imported record has changed. Rollback stopped without changing any records.');}
 for(const change of changes.sort((a:any,b:any)=>rank[b.entityType as Entity]-rank[a.entityType as Entity])){
  const model=models[change.entityType],before=unseal(change.encryptedBefore,tenantId);
  if(!before.record){
   let used=0;
   if(change.entityType==='APPOINTMENT'){used+=await tx.payment.count({where:{ticketId:change.targetId,tenantId}});used+=await tx.communication.count({where:{ticketId:change.targetId,tenantId}});used+=await tx.whiteboardSnapshotItem.count({where:{ticketId:change.targetId}});}
   if(change.entityType==='CUSTOMER'||change.entityType==='PET'){const memberships=change.entityType==='CUSTOMER'?await tx.$queryRaw`SELECT id FROM Membership WHERE customerId=${change.targetId} AND tenantId=${tenantId} LIMIT 1`:await tx.$queryRaw`SELECT id FROM Membership WHERE petId=${change.targetId} AND tenantId=${tenantId} LIMIT 1`;used+=memberships.length;}
   if(change.entityType==='EMPLOYEE'){const schedules=await tx.$queryRaw`SELECT id FROM EmployeeSchedule WHERE userId=${change.targetId} AND tenantId=${tenantId} LIMIT 1`;used+=schedules.length;}
   if(change.entityType==='CUSTOMER'){used+=await tx.ticket.count({where:{customerId:change.targetId,tenantId}});used+=await tx.communication.count({where:{customerId:change.targetId,tenantId}});used+=await tx.pet.count({where:{customerId:change.targetId,tenantId}});const ledger=await tx.$queryRaw`SELECT id FROM CustomerAccountLedger WHERE customerId=${change.targetId} AND tenantId=${tenantId} LIMIT 1`;used+=ledger.length;}
   if(change.entityType==='PET'){used+=await tx.ticketPet.count({where:{petId:change.targetId}});used+=await tx.vaccination.count({where:{petId:change.targetId,tenantId}});}
   if(change.entityType==='EMPLOYEE'){used+=await tx.employeeSession.count({where:{userId:change.targetId,tenantId}});used+=await tx.ticketLine.count({where:{assignedUserId:change.targetId}});used+=await tx.ticketAssignment.count({where:{userId:change.targetId}});}
   if(change.entityType==='SERVICE'){used+=await tx.ticketLine.count({where:{serviceId:change.targetId}});used+=await tx.packageItem.count({where:{serviceId:change.targetId,tenantId}});}
   if(used)throw Error('Imported records have subsequent activity. Rollback stopped without deleting that activity.');
   await tx[model].delete({where:{id:change.targetId}});await tx.importRecord.updateMany({where:{tenantId,source:job.source,entityType:change.entityType,targetId:change.targetId},data:{targetId:null}});}
  else{const {id,tenantId:ignored,createdAt,updatedAt,phones,...data}=before.record;for(const k of Object.keys(data))if(/At$|dateOfBirth|anniversary|firstVisit|lastVisit|dateOfHire|lastWorkDate/.test(k)&&data[k])data[k]=new Date(data[k]);await tx[model].update({where:{id},data});if(phones){await tx.customerPhone.deleteMany({where:{tenantId,customerId:id,id:{notIn:phones.map((p:any)=>p.id)}}});}if(before.link){const {id:linkId,createdAt,updatedAt,...link}=before.link;await tx.importRecord.updateMany({where:{id:linkId,tenantId},data:link});}}
 }
 await tx.importJob.update({where:{id:jobId},data:{status:'ROLLED_BACK'}});return {status:'ROLLED_BACK',restored:changes.length};
 },{timeout:240000,maxWait:15000});}
