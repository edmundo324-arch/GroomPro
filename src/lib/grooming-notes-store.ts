import {initialGroomingInstructions} from './grooming-note-defaults';
import {defaultHours,parseHours} from './operating-hours';
import {notesDeadline,parseSpecialHours,validInstructions} from './grooming-notes-rules';
import {loadBreeds} from './breed-store';

export async function noteDeadline(tx:any,n:any){
 if(!n.appointmentAt)return null;
 const [location,weekly,special]=await Promise.all([tx.location.findFirst({where:{id:n.locationId,tenantId:n.tenantId}}),tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:n.tenantId,settingKey:'OPERATING_HOURS:'+n.locationId}}}),tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:n.tenantId,settingKey:'SPECIAL_HOURS:'+n.locationId}}})]);
 if(!location)throw Error('Location not found.');
 return notesDeadline(new Date(n.appointmentAt),weekly?parseHours(weekly.value):defaultHours(),location.timezone||'America/Chicago',special?parseSpecialHours(special.value):[]);
}
export async function freezeNote(tx:any,n:any,now=new Date()):Promise<any>{
 if(n.lockedAt)return n;
 const deadline=await noteDeadline(tx,n);
 if(deadline&&now>=deadline){await tx.groomingNote.updateMany({where:{id:n.id,tenantId:n.tenantId,revision:n.revision,lockedAt:null},data:{lockedAt:deadline,finalSnapshot:{instructions:n.instructions,usual:n.usual,at:deadline.toISOString()}}});const current=await tx.groomingNote.findUnique({where:{id:n.id}});return current.lockedAt?current:freezeNote(tx,current,now);}
 return n;
}
export async function ensureGroomingNotes(tx:any,t:any,actorUserId?:string,draftNotes?:Record<string,any>){
 const pets=await tx.pet.findMany({where:{tenantId:t.tenantId,customerId:t.customerId,id:{in:t.pets.map((p:any)=>p.petId||p.pet?.id)}}});
 const breeds=await loadBreeds(tx,t.tenantId);
 for(const pet of pets){
  const key={tenantId:t.tenantId,ticketId:t.id,petId:pet.id};const existing=await tx.groomingNote.findUnique({where:{tenantId_ticketId_petId:key}});
  if(existing){const frozen=await freezeNote(tx,existing);if(!frozen.lockedAt&&String(existing.appointmentAt)!==String(t.scheduledStart))await tx.groomingNote.update({where:{id:existing.id},data:{appointmentAt:t.scheduledStart||null}});continue;}
  const previous=await tx.groomingNote.findMany({where:{tenantId:t.tenantId,petId:pet.id,ticketId:{not:t.id},appointmentAt:{not:null,...(t.scheduledStart?{lt:t.scheduledStart}:{})}},orderBy:[{appointmentAt:'desc'},{createdAt:'desc'}]});
  // Only real appointments supply history; abandoned drafts never become defaults.
  const ids=previous.map((n:any)=>n.ticketId),booked=await tx.ticket.findMany({where:{tenantId:t.tenantId,id:{in:ids},status:{notIn:['CANCELLED','NO_SHOW']}},select:{id:true}}),real=new Set(booked.map((b:any)=>b.id)),history=previous.filter((n:any)=>real.has(n.ticketId));
  const usual=history.filter((n:any)=>n.usual).sort((a:any,b:any)=>+new Date(b.usualAt)-+new Date(a.usualAt))[0];
  const instructions=initialGroomingInstructions(pet,usual?.instructions||null,history[0]?.instructions||null,breeds);
  if(!usual&&!history.length&&pet.groomingNotes)instructions.specialNotes=pet.groomingNotes;
  const draft=draftNotes?.[pet.id];if(draft&&typeof draft.usual!=='boolean')throw Error('Choose whether this is the usual haircut.');
  const source=draft?.sourceId?await tx.groomingNote.findFirst({where:{id:draft.sourceId,tenantId:t.tenantId,customerId:t.customerId,petId:pet.id}}):null;
  if(draft?.sourceId&&!source)throw Error('Grooming history must belong to this pet.');
  const applied=draft?validInstructions(draft.instructions):instructions;
  await tx.groomingNote.create({data:{...key,customerId:t.customerId,locationId:t.locationId,appointmentAt:t.scheduledStart||null,instructions:applied,usual:!!draft?.usual,usualAt:draft?.usual?new Date():null}});
  if(actorUserId)await tx.auditEntry.create({data:{tenantId:t.tenantId,actorType:'EMPLOYEE',actorUserId,entityType:'TICKET',entityId:t.id,customerId:t.customerId,action:'GROOMING_NOTES',summary:`${pet.name}: loaded grooming instructions.`,details:{petId:pet.id,sourceTicketId:source?.ticketId||usual?.ticketId||history[0]?.ticketId||null,instructions:applied,usual:!!draft?.usual}}});
 }
}
export async function snapshotGroomingClosure(tx:any,tenantId:string,ticketId:string){
 const ticket=await tx.ticket.findFirst({where:{tenantId,id:ticketId},include:{pets:true}});if(!ticket)return;
 await ensureGroomingNotes(tx,ticket);
 const records=await tx.groomingNote.findMany({where:{tenantId,ticketId}});
 for(const n of records)if(!n.closureSnapshot)await tx.groomingNote.update({where:{id:n.id},data:{closureSnapshot:{instructions:n.instructions,usual:n.usual,at:new Date().toISOString()}}});
}

export async function moveGroomingNotes(tx:any,tenantId:string,ticketId:string,date:Date){
 const records=await tx.groomingNote.findMany({where:{tenantId,ticketId}});
 for(const record of records){const n=await freezeNote(tx,record);if(!n.lockedAt)await tx.groomingNote.update({where:{id:n.id},data:{appointmentAt:date}});}
}
