import {fingerprint,seal} from '../../import/crypto';
import {readManifest,validateBatch} from './manifest';
import {projectProfile} from './profiles';
import {projectCatalog} from './catalog';
import {advanceIntegrationRevision} from './revision';
const projectionVersion=3;

export function canonical(value:any):any{
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
 return value;
}
// Caller holds the tenant lock. Acknowledgement and persisted source revisions
// share one transaction, making re-delivery safe after an uncertain HTTP result.
export async function receiveBatch(tx:any,tenantId:string,connectorId:string,schema:any,message:any){
 const spec=validateBatch(readManifest(schema),message.table,message.rows);
 const source='123pet:'+connectorId,entityType='SOURCE:'+spec.table;
 let changed=0,unchanged=0,applied=0;
 for(const row of message.rows){
  const sourceId=String(row[spec.key]),hash=fingerprint(canonical(row));
  const where={tenantId_source_entityType_sourceId:{tenantId,source,entityType,sourceId}};
  const previous=await tx.importRecord.findUnique({where});
  const prior=previous?.payload as any;
  if(prior?.fingerprint===hash&&prior.projectionVersion===projectionVersion&&prior.state!=='AWAITING_OWNER'){unchanged++;continue;}
  const projection=await projectCatalog(tx,tenantId,source,spec.table,sourceId,row,previous)||await projectProfile(tx,tenantId,source,spec.table,sourceId,row,previous);
  const payload={encrypted:seal(row,tenantId),fingerprint:hash,projectionVersion,receivedAt:new Date().toISOString(),previousFingerprint:prior?.fingerprint??null,...(prior?.projected?{projected:prior.projected}:{}),...(prior?.phones?{phones:prior.phones}:{}),...projection};
  const targetId=('targetId' in projection?projection.targetId:null)??previous?.targetId??null;
  if(projection.state==='APPLIED')applied++;
  await tx.importRecord.upsert({where,create:{tenantId,source,entityType,sourceId,targetId,payload},update:{targetId,payload}});
  changed++;
 }
 if(changed)await tx.auditEntry.create({data:{tenantId,actorType:'SYSTEM',entityType:'TENANT',entityId:connectorId,action:'SOURCE_BATCH_RECEIVED',summary:`Received ${changed} changed ${spec.table} records.`,details:{table:spec.table,changed,unchanged}}});
 if(applied)await advanceIntegrationRevision(tx,tenantId);
 return {changed,unchanged};
}
