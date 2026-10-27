import {convert,definitions} from '../../import/fields';
import {fingerprint,seal,unseal} from '../../import/crypto';
import {normalizePhone} from '../../phone-normalization';
export function sourcePhones(row:any){
 const phones=new Map<string,{number:string;normalized:string;label:string;isPrimary:boolean}>();
 const primary=normalizePhone(String(row.fldPrimaryPhoneNumber||''));
 for(const [field,label] of [['fldHomePhone','Home'],['fldCellPhone','Cell'],['fldWorkPhone','Work']]){
  const number=String(row[field]||'').trim();if(!number)continue;
  const normalized=normalizePhone(number);if(normalized.length<7||normalized.length>15||number.length>191)throw Error('Source phone number requires review.');
  if(!phones.has(normalized))phones.set(normalized,{number,normalized,label,isPrimary:normalized===primary});
 }
 return [...phones.values()];
}
const mappings:Record<string,Record<string,string>>={
 tblClients:{fldFirstName:'FirstName',fldLastName:'LastName',fldEMail:'E-mail',fldAddress:'Address',fldAddress2:'Address2',fldCity:'City',fldState:'State',fldZIP:'ZIP',fldInactive:'Inactive',fldComment:'Comment',fldPopUp:'PopUp',fldClientHistory:'ClientHistory'},
 tblPets:{fldName:'Name',fldBreed:'Breed',fldType:'Type',fldWeight:'Weight',fldGender:'Gender',fldInactive:'Inactive',fldNotes:'Notes',fldGroomComments:'GroomComments',fldPersonalityComments:'PersonalityComments',fldKennelComments:'KennelComments',fldMedicalComments:'MedicalComments',fldLength:'Length',fldColor:'Color',fldTexture:'Texture'},
};
export function profileData(table:string,row:any){
 const mapping=mappings[table];if(!mapping)return null;
 const entity=table==='tblClients'?'CUSTOMER':'PET',data:Record<string,any>={};
 for(const [column,field] of Object.entries(mapping))if(Object.hasOwn(row,column)){
  const definition=definitions[entity][field];if(row[column]===null&&definition.target==='active')continue;data[definition.target]=convert(row[column],definition);
 }
 if(entity==='CUSTOMER'){data.firstName??='';data.lastName??='';if(!data.firstName&&!data.lastName)throw Error('Customer name is missing.');}
 else if(!data.name)throw Error('Pet name is missing.');
 return data;
}
export function conflictingFields(current:any,baseline:any,incoming:any){
 return Object.keys(incoming).filter(k=>JSON.stringify(current[k]??null)!==JSON.stringify(baseline[k]??null)&&JSON.stringify(current[k]??null)!==JSON.stringify(incoming[k]??null));
}
export async function projectProfile(tx:any,tenantId:string,source:string,table:string,sourceId:string,row:any,previous:any){
 let data:any;
 try{data=profileData(table,row);}catch{return {state:'REVIEW',reason:'Profile field validation failed.'};}
 if(!data)return {state:'AWAITING_PROJECTION'};
 const model=table==='tblClients'?'customer':'pet';
 const targetId=previous?.targetId||'sync_'+fingerprint([tenantId,source,table,sourceId]).slice(0,40);
 if(model==='pet'){
  const owner=await tx.importRecord.findUnique({where:{tenantId_source_entityType_sourceId:{tenantId,source,entityType:'SOURCE:tblClients',sourceId:String(row.fldClientID)}}});
  if(!owner?.targetId)return {state:'AWAITING_OWNER',reason:'The source customer must synchronize first.'};
  if(!await tx.customer.findFirst({where:{tenantId,id:owner.targetId}}))return {state:'REVIEW',reason:'Linked customer is missing.'};
  data.customerId=owner.targetId;
 }
 const current=await tx[model].findFirst({where:{tenantId,id:targetId}});
 let phones:ReturnType<typeof sourcePhones>=[],existingPhones:any[]=[];
 if(model==='customer'){
  try{phones=sourcePhones(row)}catch{return {state:'REVIEW',reason:'Source phone number requires review.'}}
  existingPhones=await tx.customerPhone.findMany({where:{tenantId,customerId:targetId}});
  const previousPhones=previous?.payload?.phones?unseal(previous.payload.phones,tenantId):[];
  if(previousPhones.some((p:any)=>!phones.some(n=>n.normalized===p.normalized)||!existingPhones.some(n=>n.normalized===p.normalized)))return {state:'REVIEW',reason:'A phone was removed or changed; retain existing contacts until reviewed.'};
  for(const phone of phones){const owner=await tx.customerPhone.findFirst({where:{tenantId,normalized:phone.normalized}});if(owner&&owner.customerId!==targetId)return {state:'REVIEW',reason:'A source phone belongs to another GroomPro customer. Review ownership.'}}
 }
 const baseline=previous?.payload?.projected?unseal(previous.payload.projected,tenantId):null;
 if(current&&!baseline)return {state:'REVIEW',reason:'Existing record requires an explicit source match.'};
 if(!current&&previous?.targetId)return {state:'REVIEW',reason:'Linked record was removed in GroomPro.'};
 if(current&&model==='pet'&&current.customerId!==data.customerId)return {state:'REVIEW',reason:'Pet ownership changed; review is required.'};
 if(current){const fields=conflictingFields(current,baseline,data);if(fields.length)return {state:'CONFLICT',reason:'Both systems changed this profile.',conflictFields:fields};}
 if(!current&&model==='customer'&&data.email&&await tx.customer.findFirst({where:{tenantId,email:data.email}}))return {state:'REVIEW',reason:'An existing customer shares this email. Link the source record before importing.'};
 if(!current)await tx[model].create({data:{...data,id:targetId,tenantId,importSourceId:source+':'+sourceId}});
 else if(Object.keys(data).some(k=>JSON.stringify(current[k]??null)!==JSON.stringify(data[k]??null)))await tx[model].update({where:{id:targetId},data});
 for(const phone of phones)if(!existingPhones.some(p=>p.normalized===phone.normalized))await tx.customerPhone.create({data:{...phone,isPrimary:phone.isPrimary&&!existingPhones.some(p=>p.isPrimary),tenantId,customerId:targetId,smsEnabled:false,callEnabled:false}});
 return {state:'APPLIED',targetId,projected:seal(data,tenantId),...(model==='customer'?{phones:seal(phones,tenantId)}:{})};
}
