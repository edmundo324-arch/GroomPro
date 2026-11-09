import {convert} from '../../import/fields';
import {fingerprint,seal,unseal} from '../../import/crypto';
import {advanceIntegrationRevision} from './revision';
import {readManifest,validateBatch} from './manifest';

const code=(value:unknown)=>String(value??'').trim().toLowerCase();

export function validatePackageBundle(schema:any,message:any){
 const manifest=readManifest(schema);
 validateBatch(manifest,'tblPackagesSummary',[message.summary]);
 if(!Array.isArray(message.rows)||message.rows.length>1000)throw Error('Invalid package bundle.');
 const packageCode=code(message.summary.fldPackageID);
 if(!packageCode)throw Error('Package code is missing.');
 const ids=new Set<string>();
 for(let i=0;i<message.rows.length;i+=100)validateBatch(manifest,'tblPackagesRow',message.rows.slice(i,i+100));
 for(const row of message.rows){
  const id=String(row.fldPK);
  if(code(row.fldPackageID)!==packageCode||ids.has(id))throw Error('Package bundle contains unrelated or repeated items.');
  ids.add(id);
 }
 const rows=[...message.rows].sort((a,b)=>Number(a.fldOrder)-Number(b.fldOrder)||String(a.fldPK).localeCompare(String(b.fldPK),'en',{numeric:true}));
 const requested=new Set(rows.map(row=>code(row.fldPSID)));
 if(!Array.isArray(message.serviceKeys)||message.serviceKeys.length>requested.size)throw Error('Invalid package service links.');
 const keys=new Map<string,string>();
 for(const entry of message.serviceKeys){
  const key=code(entry?.code),sourceId=String(entry?.sourceId??'');
  if(!key||!requested.has(key)||keys.has(key)||!/^\d+$/.test(sourceId))throw Error('Invalid or repeated package service link.');
  keys.set(key,sourceId);
 }
 return {summary:message.summary,rows,serviceKeys:[...keys].sort(([a],[b])=>a.localeCompare(b))};
}

function nativePackage(record:any){
 return {name:record.name,description:record.description,basePriceCents:record.basePriceCents,active:record.active,
  items:record.items.map((item:any)=>({id:item.id,serviceId:item.serviceId,quantity:item.quantity,sortOrder:item.sortOrder,role:item.role})).sort((a:any,b:any)=>a.sortOrder-b.sortOrder||a.id.localeCompare(b.id))};
}

async function mappedItems(tx:any,tenantId:string,source:string,targetId:string,rows:any[],serviceKeys:[string,string][]){
 if(!rows.length)throw Error('The source package has no included services.');
 const keys=new Map(serviceKeys);
 const links=await tx.importRecord.findMany({where:{tenantId,source,entityType:'SOURCE:tblProductsAndServices',sourceId:{in:serviceKeys.map(([,id])=>id)}}});
 const bySourceId=new Map<string,string>();
 for(const link of links){
  if(!link.targetId||link.payload?.state!=='APPLIED')continue;
  const raw=unseal(link.payload.encrypted,tenantId) as {fldPS?:string;fldID?:string};
  if(raw.fldPS==='S'&&keys.get(code(raw.fldID))===link.sourceId)bySourceId.set(link.sourceId,link.targetId);
 }
 const services=await tx.service.findMany({where:{tenantId,id:{in:[...bySourceId.values()]}},select:{id:true,workflowRole:true}});
 const byId=new Map<string,{id:string;workflowRole:string}>(services.map((service:any)=>[service.id,service]));
 return rows.map((row,index)=>{
  const service=byId.get(bySourceId.get(keys.get(code(row.fldPSID))||'')||'');
  if(!service)throw Error('An included service needs a unique source link before this package can sync.');
  const quantity=convert(row.fldQuantity,{target:'quantity',kind:'int'});
  if(typeof quantity!=='number'||quantity<1||quantity>1000||Number(row.fldQuantity)!==quantity)throw Error('An included service has an unsupported quantity.');
  return {id:'sync_'+fingerprint([targetId,String(row.fldPK)]).slice(0,40),serviceId:service.id,quantity,sortOrder:index,role:service.workflowRole||'ADD_ON'};
 });
}

// Each SQL bundle is a complete package read. Tenant locking and source IDs
// keep retries consistent while package fields edited in GroomPro go to review.
export async function receivePackageBundle(tx:any,tenantId:string,connectorId:string,schema:any,message:any){
 const bundle=validatePackageBundle(schema,message),source='123pet:'+connectorId,entityType='PACKAGE_BUNDLE',sourceId=String(bundle.summary.fldPK);
 const where={tenantId_source_entityType_sourceId:{tenantId,source,entityType,sourceId}};
 const previous=await tx.importRecord.findUnique({where}),hash=fingerprint(bundle);
 if(previous?.payload?.fingerprint===hash&&previous.payload.state==='APPLIED')return {changed:0,unchanged:1,applied:0};
 const payload:any={encrypted:seal(bundle,tenantId),fingerprint:hash,receivedAt:new Date().toISOString(),state:'REVIEW',reason:''};
 if(previous?.payload?.nativeSnapshot)payload.nativeSnapshot=previous.payload.nativeSnapshot;
 let targetId=previous?.targetId??null;
 const id=targetId||'sync_'+fingerprint([tenantId,source,entityType,sourceId]).slice(0,40);
 const current=await tx.package.findFirst({where:{tenantId,id},include:{items:true}});
 let data;
 let items:Awaited<ReturnType<typeof mappedItems>>|undefined;
 try{
  const name=convert(bundle.summary.fldName,{target:'name',kind:'text'});
  const description=convert(bundle.summary.fldComments,{target:'description',kind:'text'});
  const basePriceCents=convert(bundle.summary.fldRetail,{target:'price',kind:'money'});
  if(typeof name!=='string'||!name||name.length>191||typeof basePriceCents!=='number'||basePriceCents<0)throw Error('The package needs a valid name and price.');
  data={name,description,basePriceCents,active:bundle.summary.fldInactive==null||!convert(bundle.summary.fldInactive,{target:'inactive',kind:'bool'})};
  if(targetId&&!current)throw Error('The linked GroomPro package was removed.');
  if(current&&(!previous?.payload?.nativeSnapshot||fingerprint(nativePackage(current))!==fingerprint(unseal(previous.payload.nativeSnapshot,tenantId))))throw Error('GroomPro changed this package. Review both versions.');
  if(!current&&await tx.package.findFirst({where:{tenantId,name},select:{id:true}}))throw Error('A GroomPro package with this name already exists. Review before linking.');
  const mapped=await mappedItems(tx,tenantId,source,id,bundle.rows,bundle.serviceKeys);
  if(current?.items.some((item:any)=>!mapped.some(next=>next.id===item.id)))throw Error('An included service was removed in 123Pet. Review the package before updating.');
  items=mapped;
 }catch(e){payload.reason=(e as Error).message}
 if(!payload.reason&&data&&items){
  const include={items:true};
  const saved=current
   ?await tx.package.update({where:{id},data:{...data,items:{upsert:items.map(({id:itemId,...item})=>({where:{id:itemId},create:{...item,id:itemId,tenantId},update:item}))}},include})
   :await tx.package.create({data:{...data,id,tenantId,items:{create:items.map(item=>({...item,tenantId}))}},include});
  targetId=saved.id;payload.state='APPLIED';payload.nativeSnapshot=seal(nativePackage(saved),tenantId);
 }
 await tx.importRecord.upsert({where,create:{tenantId,source,entityType,sourceId,targetId,payload},update:{targetId,payload}});
 if(payload.state==='APPLIED')await advanceIntegrationRevision(tx,tenantId);
 return {changed:1,unchanged:0,applied:payload.state==='APPLIED'?1:0,state:payload.state};
}
