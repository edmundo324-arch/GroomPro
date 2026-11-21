import {randomUUID} from 'node:crypto';
import {tenantExport,portableValue} from './tenant-export';
import {isPlatformRole} from './roles';

type Tables=Record<string,any[]>;
const freshId=()=> 'sample_'+randomUUID().replace(/-/g,'');
// Copy records, never live identities, payment tokens or provider delivery receipts.
export function prepareSampleRecords(input:Tables,sourceId:string,targetId:string,locationId:string,ownerId:string,ownerEmail:string){
 const tables:Tables=structuredClone(input),ids=new Map<string,string>([[sourceId,targetId]]);
 delete tables.Tenant;delete tables.CustomerPaymentMethod;
 const locations=(tables.Location||[]).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
 if(!locations.length)throw Error('The sample business needs a location before it can be copied.');
 ids.set(locations[0].id,locationId);
 for(const row of tables.User||[])if(isPlatformRole(row.role))ids.set(row.id,ownerId);
 const imported=tables.ImportedSource||[];delete tables.ImportedSource;
 tables.ImportRecord=imported.map(row=>({...row,tenantId:sourceId,payload:row.original,updatedAt:new Date().toISOString()}));for(const row of tables.ImportRecord)delete row.original;
 tables.TenantSetting=tables.BusinessSettings||[];delete tables.BusinessSettings;
 for(const rows of Object.values(tables))for(const row of rows)if(typeof row.id==='string'&&!ids.has(row.id))ids.set(row.id,freshId());
 const remap=(value:any):any=>{
  if(typeof value==='string')return ids.get(value)||value.split(/([:/?&=#])/).map(v=>ids.get(v)||v).join('');
  if(Array.isArray(value))return value.map(remap);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[remap(k),remap(v)]));
  return value;
 };
 const output:Tables={};
 for(const [name,rows] of Object.entries(tables))output[name]=rows.filter(row=>!(name==='Location'&&row.id===locations[0].id)&&!(name==='User'&&isPlatformRole(row.role))).map(original=>{
  const row=remap(original);
  if(name==='User'){row.pinHash='IMPORT_DISABLED';row.pinPrefixHashes=[];if(row.email?.toLowerCase()===ownerEmail.toLowerCase())row.email=null;}
  if(['Communication','Payment','Subscription','MembershipPayment'].includes(name))row.externalId=null;
  if(name==='AuditEntry'&&row.actorUserId&&!Array.from(ids.values()).includes(row.actorUserId))row.actorUserId=ownerId;
  return row;
 });
 return {tables:output,ids};
}

// Called only inside CREATE_BUSINESS's transaction, after creating its new owner.
export async function copySampleBusiness(tx:any,sourceId:string,targetId:string,locationId:string,ownerId:string,ownerEmail:string){
 if(sourceId===targetId||!await tx.tenant.findUnique({where:{id:sourceId},select:{id:true}}))throw Error('Choose an existing business to copy sample records from.');
 if(await tx.customer.count({where:{tenantId:targetId}}))throw Error('Sample records can only be copied into a newly created business.');
 const snapshot=await tenantExport(tx,sourceId);
 if(snapshot.warnings.length)throw Error('Some original imported records could not be read. Resolve the source import access before copying this business.');
 snapshot.tables.WhiteboardSnapshotItem=portableValue(await tx.whiteboardSnapshotItem.findMany({where:{snapshot:{tenantId:sourceId}}}));
 const extraSettings=await tx.tenantSetting.findMany({where:{tenantId:sourceId,settingKey:{in:["primaryColor","secondaryColor","readyColor","vipAvailableEmoji","vipNotAvailableEmoji","readyMessageVipGrooming","readyMessageVipFullWash","readyMessageNonVip"]}}});
 snapshot.tables.BusinessSettings.push(...portableValue(extraSettings));
 const firstId=[...snapshot.tables.Location].sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)))[0]?.id;
 const firstLocation=firstId?await tx.location.findUnique({where:{id:firstId,tenantId:sourceId}}):null;
 if(firstLocation){const {id,tenantId,name,timezone,createdAt,updatedAt,...details}=firstLocation;await tx.location.update({where:{id:locationId},data:details});}
 const prepared=prepareSampleRecords(snapshot.tables,sourceId,targetId,locationId,ownerId,ownerEmail);
 const columns:any[]=await tx.$queryRaw`SELECT TABLE_NAME AS tableName,COLUMN_NAME AS columnName,DATA_TYPE AS dataType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()`;
 const relations:any[]=await tx.$queryRaw`SELECT TABLE_NAME AS tableName,REFERENCED_TABLE_NAME AS parent FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`;
 const pending=new Set(Object.keys(prepared.tables).filter(name=>prepared.tables[name].length));const counts:Record<string,number>={};
 while(pending.size){
  const name=[...pending].find(name=>!relations.some(r=>r.tableName===name&&r.parent!==name&&pending.has(r.parent)));
  if(!name)throw Error('The sample records contain a relationship that cannot be copied safely. No new business was saved.');
  const fields=columns.filter(c=>c.tableName===name);
  if(!fields.length)throw Error('The database is missing '+name+'. Update the database before copying sample records.');
  if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)||fields.some(f=>!/^\w+$/.test(f.columnName)))throw Error('Invalid database field.');
  for(const row of prepared.tables[name]){
   const used=fields.filter(f=>Object.hasOwn(row,f.columnName));
   const values=used.map(f=>{let value=row[f.columnName];if(value===null)return null;if(f.dataType==='json')return JSON.stringify(value);if(['datetime','timestamp'].includes(f.dataType)&&typeof value==='string')return new Date(value);return value;});
   await tx.$executeRawUnsafe('INSERT INTO `'+name+'` ('+used.map(f=>'`'+f.columnName+'`').join(',')+') VALUES ('+used.map(()=>'?').join(',')+')',...values);
  }
  counts[name]=prepared.tables[name].length;pending.delete(name);
 }
 await tx.tenantSetting.create({data:{tenantId:targetId,settingKey:'SAMPLE_BUSINESS_COPY',value:{sourceId,copiedAt:new Date().toISOString(),counts,freshEmployeePinsRequired:true}}});
 return counts;
}
