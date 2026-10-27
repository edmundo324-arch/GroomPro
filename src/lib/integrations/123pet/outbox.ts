import {fingerprint,seal,unseal} from '../../import/crypto';
import {assertWrite,ConnectorConfig} from './control';
import {canonical} from './inbox';
export const writeOperations={
 CUSTOMER_CONTACT:{table:'tblClients',key:'fldClientID',fields:['fldFirstName','fldLastName','fldEMail','fldAddress','fldAddress2','fldCity','fldState','fldZIP']},
 PET_INSTRUCTIONS:{table:'tblPets',key:'fldPetID',fields:['fldNotes','fldGroomComments','fldPersonalityComments','fldKennelComments','fldMedicalComments']},
} as const;
export function validateWrite(input:any){
 if(!Object.hasOwn(writeOperations,input?.operation))throw Error('Unsupported write operation.');
 const spec=writeOperations[input.operation as keyof typeof writeOperations];
 if(!Number.isSafeInteger(input.sourceId)||input.sourceId<0)throw Error('Invalid source identifier.');
 const fields=Object.keys(input.values||{}).sort();
 if(!fields.length||fields.some(k=>!(spec.fields as readonly string[]).includes(k)))throw Error('Unapproved write field.');
 if(JSON.stringify(fields)!==JSON.stringify(Object.keys(input.expected||{}).sort()))throw Error('Every write field requires its expected source value.');
 for(const values of [input.values,input.expected])for(const [key,value] of Object.entries(values))if(value!==null&&(typeof value!=='string'||value.length>(key.includes('Comments')||key==='fldNotes'?100000:191)))throw Error('Invalid source value.');
 return {operation:input.operation,sourceId:input.sourceId,expected:input.expected,values:input.values};
}
export async function enqueueWrite(tx:any,config:ConnectorConfig,input:any,actorId:string){
 const command=validateWrite(input);
 const evidence=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:config.tenantId,settingKey:`123PET_VERIFIED:${config.id}:${command.operation}`}}});
 const approval=evidence?.value as any;
 assertWrite(config,{verifiedTest:approval?.schemaFingerprint===config.schemaFingerprint&&approval?.verifiedTest===true,productionAuthorized:approval?.productionAuthorized===true});
 if(typeof input.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(input.requestId))throw Error('A stable operation identifier is required.');
 const where={tenantId_source_entityType_sourceId:{tenantId:config.tenantId,source:'123pet:'+config.id,entityType:'WRITE_COMMAND',sourceId:input.requestId}};
 const hash=fingerprint(canonical(command)),existing=await tx.importRecord.findUnique({where});
 if(existing){if((existing.payload as any).fingerprint!==hash)throw Error('Operation identifier was reused for different changes.');return {id:input.requestId,state:(existing.payload as any).state};}
 await tx.importRecord.create({data:{...where.tenantId_source_entityType_sourceId,payload:{state:'PENDING',fingerprint:hash,encrypted:seal(command,config.tenantId),requestedBy:actorId,requestedAt:new Date().toISOString()}}});
 await tx.auditEntry.create({data:{tenantId:config.tenantId,actorType:'EMPLOYEE',actorUserId:actorId,entityType:'TENANT',entityId:config.tenantId,action:'123PET_WRITE_QUEUED',summary:'Queued verified '+command.operation+' operation.',details:{connectorId:config.id,requestId:input.requestId}}});
 return {id:input.requestId,state:'PENDING'};
}
export async function pendingWrites(tx:any,config:ConnectorConfig){
 if(!config.writeEnabled||config.revoked)return [];
 const rows=await tx.importRecord.findMany({where:{tenantId:config.tenantId,source:'123pet:'+config.id,entityType:'WRITE_COMMAND'},orderBy:{createdAt:'asc'}});
 const commands=[];
 for(const row of rows){const p=row.payload as any;if(p.state!=='PENDING')continue;
  const command=unseal(p.encrypted,config.tenantId);validateWrite(command);
  const evidence=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:config.tenantId,settingKey:`123PET_VERIFIED:${config.id}:${command.operation}`}}});
  const a=evidence?.value as any;
  if(a?.schemaFingerprint!==config.schemaFingerprint||!a?.verifiedTest||(config.environment==='PRODUCTION'&&!a?.productionAuthorized))continue;
  commands.push({id:row.sourceId,...command});if(commands.length===20)break;
 }
 return commands;
}
export async function acknowledgeWrite(tx:any,config:ConnectorConfig,input:any){
 if(!['APPLIED','CONFLICT','FAILED','UNCERTAIN'].includes(input.state))throw Error('Invalid write outcome.');
 const row=await tx.importRecord.findUnique({where:{tenantId_source_entityType_sourceId:{tenantId:config.tenantId,source:'123pet:'+config.id,entityType:'WRITE_COMMAND',sourceId:String(input.id)}}});
 if(!row)throw Error('Unknown operation.');const previous=row.payload as any;
 if(previous.state!=='PENDING'){if(previous.state!==input.state)throw Error('Conflicting operation outcome.');return;}
 await tx.importRecord.update({where:{id:row.id},data:{payload:{...previous,state:input.state,completedAt:new Date().toISOString()}}});
 await tx.auditEntry.create({data:{tenantId:config.tenantId,actorType:'SYSTEM',entityType:'TENANT',entityId:config.tenantId,action:'123PET_WRITE_RESULT',summary:'123Pet operation '+input.state+'.',details:{connectorId:config.id,requestId:input.id}}});
}
