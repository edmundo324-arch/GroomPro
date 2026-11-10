import {randomUUID} from 'node:crypto';
import {db} from './db';
import {agreementTitle,verifiedSignature,type Signature} from './customer-agreement-model';
import {agreementRevision,renderAgreementPdf,type SignedAgreement} from './customer-agreement-pdf';
import {agreementError,agreementProfile,allowedAgreementEmail,markAgreementSigned,readableAgreement,readAccess} from './customer-agreement-store';

const signedPdfPrefix='GROOMPRO_PDF_V1:';
export function parseAgreementPdf(value:string){
 return value.startsWith(signedPdfPrefix)?value.slice(signedPdfPrefix.length):null;
}
function emailConfig(tenantId:string){
 try{
  const config=JSON.parse(process.env.GROOMPRO_AGREEMENT_EMAIL_TENANTS_JSON||'{}')[tenantId];
  if(typeof config?.apiKey==='string'&&typeof config?.from==='string')return config as {apiKey:string;from:string};
 }catch{}
 return null;
}
async function emailAgreement(tenantId:string,id:string,filename:string,pdf:string,to:string,shopEmail:string){
 const config=emailConfig(tenantId);
 if(!config)return false;
 // Send separately so the customer never sees another recipient's address.
 const results=await Promise.all([...new Set([to,shopEmail])].map(async (recipient,index)=>{
  try{
   const response=await fetch('https://api.resend.com/emails',{
    method:'POST',headers:{Authorization:'Bearer '+config.apiKey,'Content-Type':'application/json','Idempotency-Key':'agreement-'+id+'-'+index},
    body:JSON.stringify({from:config.from,to:[recipient],subject:'Your signed GroomPro agreement',
     text:'Your signed agreement is attached.',attachments:[{filename,content:pdf}]}),
    signal:AbortSignal.timeout(12000),
   });
   return response.ok;
  }catch{return false;}
 }));
 return results.every(Boolean);
}
export async function signAgreement(tenantId:string,token:string,input:{signature:Signature;revision:string;selectedPets?:string[]}){
 const result=await db.$transaction(async tx=>{
  const state=await readAccess(tx,tenantId,token,true);readableAgreement(state);
  if(!state.customerId)throw agreementError('Complete your profile first.');
  if(state.documentId){
   const [saved]=await tx.$queryRaw<{documentContent:string;customerEmail:string;sentCopy:number}[]>`SELECT documentContent,customerEmail,sentCopy FROM SignedDocument WHERE id=${state.documentId} AND tenantId=${tenantId} AND customerId=${state.customerId}`;
   const pdf=saved&&parseAgreementPdf(saved.documentContent);
   if(!pdf)throw agreementError('The shop can help retrieve your signed copy.');
   return {id:state.documentId,pdf,to:saved.customerEmail,shopEmail:state.shopEmail,kind:state.kind,bookingUrl:state.bookingUrl,sent:!!saved.sentCopy};
  }
  let signature:Signature;
  try{signature=verifiedSignature(input.signature,state.terms.clauses);}
  catch(error){throw agreementError((error as Error).message);}
  const profile=await agreementProfile(tx,tenantId,state);
  if(!profile.email||!allowedAgreementEmail(profile.email)||!profile.pets.length)throw agreementError('Enter your email and at least one dog before signing.');
  if(state.kind==='intake'&&(!profile.address1||!profile.city||!profile.postalCode))throw agreementError('Enter your street address, city, and ZIP code before signing.');
  if(agreementRevision(profile,state.terms,state.quote)!==input.revision)throw agreementError('The profile changed. Review the latest details before signing.');
  const chosen=Array.isArray(input.selectedPets)?input.selectedPets:[];
  const quote=state.kind==='vip'?state.quote.filter(q=>chosen.includes(q.petId)):[];
  if(state.kind==='vip'){
   if(!Array.isArray(chosen)||!quote.length||quote.length!==new Set(chosen).size||quote.some(q=>!profile.pets.some(p=>p.id===q.petId)))throw agreementError('Choose the dogs enrolling in VIP.');
   profile.pets=profile.pets.filter(p=>quote.some(q=>q.petId===p.id));
  }
  const tenant=await tx.tenant.findUniqueOrThrow({where:{id:tenantId},select:{name:true}});
  const now=new Date(),id=randomUUID(),title=agreementTitle[state.kind];
  const snapshot:SignedAgreement={business:tenant.name,kind:state.kind,profile,terms:state.terms,quote,signature,signedAt:now.toISOString()};
  const pdf=renderAgreementPdf(snapshot).toString('base64');
  const content=signedPdfPrefix+pdf,documentType=state.kind==='intake'?'NEW_CUSTOMER_CONTRACT':'VIP_SIGNUP';
  const signatureData=JSON.stringify({signature,quote});
  const petId=profile.pets.length===1?profile.pets[0].id:null;
  await tx.$executeRaw`INSERT INTO SignedDocument (id,tenantId,customerId,petId,documentType,title,version,status,signedAt,signedByName,customerEmail,documentContent,signatureData) VALUES (${id},${tenantId},${state.customerId},${petId},${documentType},${title},${state.terms.version},'SIGNED',${now},${signature.name},${profile.email},${content},${signatureData})`;
  await tx.auditEntry.create({data:{tenantId,actorType:'SYSTEM',entityType:'CUSTOMER',entityId:state.customerId,customerId:state.customerId,action:'DOCUMENT_SIGNED',summary:title+' signed by customer.',details:{documentId:id,version:state.terms.version,channel:state.channel}}});
  await markAgreementSigned(tx,tenantId,token,state,id);
  return {id,pdf,to:profile.email,shopEmail:state.shopEmail,kind:state.kind,bookingUrl:state.bookingUrl,sent:false};
 });
 const filename=result.kind==='vip'?'VIP Signup Agreement.pdf':'New Customer Intake.pdf';
 const emailed=result.sent||await emailAgreement(tenantId,result.id,filename,result.pdf,result.to,result.shopEmail);
 if(emailed&&!result.sent)await db.$executeRaw`UPDATE SignedDocument SET sentCopy=1 WHERE tenantId=${tenantId} AND id=${result.id}`;
 return {id:result.id,pdf:result.pdf,filename,emailed,bookingUrl:result.bookingUrl};
}
