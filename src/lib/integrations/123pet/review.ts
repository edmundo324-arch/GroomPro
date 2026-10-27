import {unseal} from '../../import/crypto';
const models:Record<string,string>={'SOURCE:tblEmployees':'user','SOURCE:tblProductsAndServices':'catalog'};
export async function connectionReview(tx:any,tenantId:string,connectorId:string){
 const rows=await tx.importRecord.findMany({where:{tenantId,source:'123pet:'+connectorId},orderBy:[{entityType:'asc'},{sourceId:'asc'}]});
 const counts:Record<string,number>={};const reviews:any[]=[];
 for(const row of rows){if(row.entityType==='OUTBOUND_SNAPSHOT'||row.entityType==='WRITE_COMMAND')continue;const payload=row.payload as any;counts[payload.state||'STAGED']=(counts[payload.state||'STAGED']||0)+1;
  if(!['REVIEW','CONFLICT','AWAITING_OWNER'].includes(payload.state)||reviews.length>=100)continue;
  const data=unseal(payload.encrypted,tenantId) as any;
  const label=row.entityType==='TICKET_BUNDLE'?'123Pet ticket #'+data.summary.fldTicketID:row.entityType==='SOURCE:tblEmployees'?[data.fldFirstName,data.fldLastName].filter(Boolean).join(' '):data.fldName||data.fldDescription||row.sourceId;
  const type=models[row.entityType];let candidates:any[]=[];
  if(type==='user')candidates=await tx.user.findMany({where:{tenantId,firstName:String(data.fldFirstName||''),lastName:String(data.fldLastName||'')},select:{id:true,firstName:true,lastName:true,displayName:true}});
  if(type==='catalog')candidates=await tx[data.fldPS==='P'?'product':'service'].findMany({where:{tenantId,[data.fldPS==='P'?'sku':'code']:String(data.fldID)},select:{id:true,name:true}});
  reviews.push({id:row.id,label,reason:payload.reason,state:payload.state,candidates:candidates.map(c=>({id:c.id,label:c.name||c.displayName||[c.firstName,c.lastName].filter(Boolean).join(' ')}))});
 }
 return {counts,reviews};
}
export async function linkReviewedRecord(tx:any,tenantId:string,connectorId:string,recordId:string,targetId:string,actorUserId:string){
 const source='123pet:'+connectorId,record=await tx.importRecord.findFirst({where:{id:recordId,tenantId,source}});
 if(!record||!models[record.entityType])throw Error('This record needs a different reconciliation workflow.');
 const payload=record.payload as any,data=unseal(payload.encrypted,tenantId) as any;
 const model=record.entityType==='SOURCE:tblEmployees'?'user':data.fldPS==='P'?'product':'service';
 if(!await tx[model].findFirst({where:{tenantId,id:targetId}}))throw Error('Choose a record in this business.');
 const existing=await tx.importRecord.findFirst({where:{tenantId,source,entityType:record.entityType,targetId,NOT:{id:record.id}}});
 if(existing)throw Error('That record is already linked to another 123Pet record.');
 await tx.importRecord.update({where:{id:record.id},data:{targetId,payload:{...payload,state:'APPLIED',reason:null,mappingOnly:true}}});
 await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId,entityType:'TENANT',entityId:connectorId,action:'SOURCE_RECORD_LINKED',summary:'Linked a reviewed 123Pet record without replacing its GroomPro details or access.',details:{recordId,targetId,entityType:record.entityType}}});
 return {linked:true};
}
