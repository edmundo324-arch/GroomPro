import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {vaccinationFields,vaccinationRevision} from '@/src/lib/vaccination-records';
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function handle(r:NextRequest){const session=await platformSession(r);if(!session)return reply({error:'Enter your employee PIN.'},401);const tenantId=session.tenantId;
 try{const body=r.method==='GET'?null:await r.json(),petId=String(body?.petId||r.nextUrl.searchParams.get('petId')||'');
 const pet=await db.pet.findFirst({where:{tenantId,id:petId},select:{id:true,name:true,customerId:true}});if(!pet||!await db.customer.findFirst({where:{tenantId,id:pet.customerId},select:{id:true}}))return reply({error:'This pet is not available at your current shop.'},404);
 if(r.method==='GET'){const rows=await db.vaccination.findMany({where:{tenantId,petId},orderBy:{administeredAt:'desc'}});return reply({records:rows.map(row=>({...row,revision:vaccinationRevision(row)}))});}
 if(r.method==='PATCH'&&!body.id)return reply({error:'Choose the vaccination record to edit.'},400);
 if(r.method==='POST'&&!/^[a-f0-9-]{36}$/i.test(body.requestId||''))return reply({error:'Reopen the vaccination form before saving.'},400);
 const fields=vaccinationFields(body),record=await db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM Pet WHERE id=${petId} AND tenantId=${tenantId} FOR UPDATE`;
 const currentPet=await tx.pet.findFirst({where:{tenantId,id:petId,customerId:pet.customerId}});if(!currentPet)throw Error('This pet’s owner changed. Reopen the pet profile before saving.');
 const id=r.method==='PATCH'?String(body.id||''):null;let previous=null;if(id){previous=await tx.vaccination.findFirst({where:{tenantId,petId,id}});if(!previous)throw Error('This vaccination record is unavailable. Refresh the list.');if(body.revision!==vaccinationRevision(previous))throw Error('This vaccination record changed. Reopen it before saving; your edits are still here.');}
 if(!previous){const repeated=await tx.vaccination.findFirst({where:{tenantId,petId,id:body.requestId}});if(repeated){if(JSON.stringify(vaccinationFields({...repeated,administeredAt:repeated.administeredAt.toISOString().slice(0,10),expiresAt:repeated.expiresAt?.toISOString().slice(0,10)}))!==JSON.stringify(fields))throw Error('This vaccination was already saved with different details. Refresh before editing it.');return repeated;}}
 const saved=previous?await tx.vaccination.update({where:{id:previous.id},data:fields}):await tx.vaccination.create({data:{id:body.requestId,tenantId,customerId:pet.customerId,petId,...fields}});
 if(body.documentId){const where={tenantId_settingKey:{tenantId,settingKey:'PET_DOCUMENT:'+String(body.documentId)}},document=await tx.tenantSetting.findUnique({where}),value=document?.value as any;if(!value||value.petId!==petId)throw Error('Choose a document belonging to this pet.');await tx.vaccination.update({where:{id:saved.id},data:{documentUrl:'/api/pets/documents?id='+encodeURIComponent(value.id)}});await tx.tenantSetting.update({where,data:{value:{...value,state:'REVIEWED',reviewedAt:new Date().toISOString(),reviewedBy:session.user.id,vaccinationId:saved.id,vaccinationIds:[...new Set([...(value.vaccinationIds||[]),...(value.vaccinationId?[value.vaccinationId]:[]),saved.id])]}}});saved.documentUrl='/api/pets/documents?id='+encodeURIComponent(value.id);}
 await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'CUSTOMER',entityId:pet.customerId,customerId:pet.customerId,action:previous?'VACCINATION_EDIT':'VACCINATION_ADD',summary:previous?'Updated vaccination record.':'Added vaccination record.',details:{petId,vaccinationId:saved.id,before:previous?JSON.parse(JSON.stringify(previous)):null,after:JSON.parse(JSON.stringify(saved))}}});return saved;
 });return reply({record:{...record,revision:vaccinationRevision(record)}});
 }catch(e){return reply({error:(e as Error).message},400);}}
export const GET=withRequestPolicy(handle,{feature:'PETS'});
export const POST=withRequestPolicy(handle,{feature:'PETS'});
export const PATCH=withRequestPolicy(handle,{feature:'PETS'});
