import {db} from './db';
import {documentFile,petDocumentAccess} from './pet-documents';
export const petPhotoPrefix='PET_PHOTO:';
export function photoDetails(input:any){
 const file=documentFile(input);if(!file.mime.startsWith('image/'))throw Error('Choose a JPEG or PNG grooming photo, up to 5 MB.');
 const date=String(input.date||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(+new Date(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Choose the date this grooming photo was taken.');
 if(!['BEFORE','AFTER','OTHER'].includes(input.stage))throw Error('Choose Before grooming, After grooming or Other photo.');
 const caption=String(input.caption||'').trim();if(caption.length>500)throw Error('Keep the photo note under 500 characters.');
 return {...file,date,stage:input.stage,caption};
}
export async function savePetPhoto(tenantId:string,actorUserId:string,input:any){
 if(!/^[a-f0-9-]{36}$/i.test(input.id||''))throw Error('Choose the photo again before uploading.');const photo=photoDetails(input),petId=String(input.petId||''),ticketId=input.ticketId?String(input.ticketId):null;
 return db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM Pet WHERE tenantId=${tenantId} AND id=${petId} FOR UPDATE`;const pet=await petDocumentAccess(tx,tenantId,petId);
  if(ticketId&&!await tx.ticket.findFirst({where:{tenantId,id:ticketId,OR:[{pets:{some:{petId}}},{lines:{some:{petId}}}]},select:{id:true}}))throw Error('Choose a ticket that includes this dog.');
  const where={tenantId_settingKey:{tenantId,settingKey:petPhotoPrefix+input.id}},old=(await tx.tenantSetting.findUnique({where}))?.value as any;
  if(old){if(old.petId!==petId||old.sha256!==photo.sha256||old.date!==photo.date||old.stage!==photo.stage||old.caption!==photo.caption||old.ticketId!==ticketId)throw Error('This upload changed. Choose the photo again.');return old;}
  const {data,...metadata}=photo,value={id:input.id,petId,ticketId,customerId:pet.customerId,...metadata,createdAt:new Date().toISOString(),createdBy:actorUserId};
  await tx.tenantSetting.create({data:{tenantId,settingKey:where.tenantId_settingKey.settingKey,value}});await tx.tenantSetting.create({data:{tenantId,settingKey:'PET_PHOTO_FILE:'+input.id,value:{data}}});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId,entityType:'PET',entityId:petId,customerId:pet.customerId,action:'GROOMING_PHOTO_SAVED',summary:'Saved a dated grooming photo.',details:{photoId:input.id,ticketId,date:photo.date,stage:photo.stage}}});return value;
 });
}
export async function listPetPhotos(tenantId:string,petId:string,ticketId?:string){await petDocumentAccess(db,tenantId,petId);const rows=await db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:petPhotoPrefix},value:{path:'$.petId',equals:petId}},select:{value:true}});return rows.map(r=>r.value as any).filter(p=>!ticketId||p.ticketId===ticketId).map(({sha256,...p})=>p).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));}
export async function readPetPhoto(tenantId:string,id:string){const p=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:petPhotoPrefix+id}}}))?.value as any;if(!p)throw Error('This grooming photo is unavailable.');await petDocumentAccess(db,tenantId,p.petId);const file=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'PET_PHOTO_FILE:'+id}}}))?.value as any;if(!file?.data)throw Error('This photo file is unavailable.');return {...p,data:file.data};}
