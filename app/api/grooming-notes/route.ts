import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {ensureGroomingNotes,freezeNote,noteDeadline} from '@/src/lib/grooming-notes-store';
import {initialGroomingInstructions} from '@/src/lib/grooming-note-defaults';
import {noteFields,noteLabels,validInstructions} from '@/src/lib/grooming-notes-rules';
import {loadBreeds} from '@/src/lib/breed-store';
const tenant=(r:NextRequest)=>r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
export async function GET(r:NextRequest){
 const tenantId=tenant(r);if(!tenantId)return NextResponse.json({error:'Business context is required.'},{status:401});
 try{const customerId=r.nextUrl.searchParams.get('customerId')||'',ticketId=r.nextUrl.searchParams.get('ticketId')||'';
 const result=await db.$transaction(async tx=>{
 const customer=await tx.customer.findFirst({where:{id:customerId,tenantId},select:{id:true,notes:true}});if(!customer)throw Error('Customer not found.');
 const pets=await tx.pet.findMany({where:{tenantId,customerId},select:{id:true,name:true,breed:true,breedId:true,notes:true,groomingNotes:true}});
 if(ticketId){await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticketId} AND tenantId=${tenantId} FOR UPDATE`;const t=await tx.ticket.findFirst({where:{id:ticketId,tenantId,customerId},include:{pets:true}});if(!t)throw Error('Appointment not found.');await ensureGroomingNotes(tx,t);}
 const notes=await tx.groomingNote.findMany({where:{tenantId,customerId},orderBy:[{appointmentAt:'desc'},{createdAt:'desc'}]});
 const tickets=await tx.ticket.findMany({where:{tenantId,customerId,id:{in:notes.map(n=>n.ticketId)}},select:{id:true,scheduledStart:true,orderNumber:true,status:true}}),ticketMap=new Map(tickets.map(t=>[t.id,t]));
 const records:any[]=[];for(const n of notes){const t=ticketMap.get(n.ticketId);if(!t)continue;let current=await freezeNote(tx,n);if(!current.lockedAt&&String(n.appointmentAt)!==String(t.scheduledStart))current=await tx.groomingNote.update({where:{id:n.id},data:{appointmentAt:t.scheduledStart}});current=await freezeNote(tx,current);records.push({...current,deadline:current.lockedAt||await noteDeadline(tx,current),orderNumber:t.orderNumber,status:t.status})}
 const breeds=await loadBreeds(tx,tenantId);
 return {customer,pets,records,defaults:Object.fromEntries(pets.map(p=>{const history=records.filter(n=>n.petId===p.id&&n.ticketId!==ticketId&&!['CANCELLED','NO_SHOW'].includes(n.status)&&n.appointmentAt&&+n.appointmentAt<=Date.now()),usual=history.filter(n=>n.usual).sort((a,b)=>+(b.usualAt||0)-+(a.usualAt||0))[0];const v=initialGroomingInstructions(p,usual?.instructions as any,history[0]?.instructions as any,breeds);if(!usual&&!history.length&&p.groomingNotes)v.specialNotes=p.groomingNotes;return [p.id,v]}))};
 },{timeout:30000});return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}
}
export async function PATCH(r:NextRequest){
 const tenantId=tenant(r),sid=r.cookies.get('groompro_session')?.value,session=sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 try{const b=await r.json();const result=await db.$transaction(async tx=>{
 if(b.permanent){
  if(!['PET','CUSTOMER'].includes(b.permanent)||typeof b.value!=='string'||b.value.length>20000)throw Error('Enter valid permanent notes.');
  const model=b.permanent==='PET'?tx.pet:tx.customer;
  const entity=await (model as any).findFirst({where:{id:String(b.entityId),tenantId}});if(!entity)throw Error('Record not found.');
  const previous=entity.notes||'';if(previous!==b.previous)throw Error('These notes changed in another window. Your text is retained; reload the notes before saving again.');
  const changed=await (model as any).updateMany({where:{id:entity.id,tenantId,notes:entity.notes},data:{notes:b.value}});if(changed.count!==1)throw Error('Notes changed in another window. Please reload.');
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:b.permanent,entityId:entity.id,customerId:b.permanent==='PET'?entity.customerId:entity.id,action:'PERMANENT_NOTES',summary:'Updated permanent notes.',details:{previous,value:b.value}}});return {ok:true};
 }
 const candidate=await tx.groomingNote.findFirst({where:{id:String(b.id),tenantId}});if(!candidate)throw Error('Grooming record not found.');
 await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${candidate.ticketId} AND tenantId=${tenantId} FOR UPDATE`;
 let n=await tx.groomingNote.findFirstOrThrow({where:{id:candidate.id,tenantId}});
 const ticket=await tx.ticket.findFirst({where:{id:n.ticketId,tenantId,customerId:n.customerId}});if(!ticket)throw Error('Appointment not found.');
 n=await freezeNote(tx,n);
 if(!n.lockedAt&&String(n.appointmentAt)!==String(ticket.scheduledStart))n=await tx.groomingNote.update({where:{id:n.id},data:{appointmentAt:ticket.scheduledStart}});
 n=await freezeNote(tx,n);if(n.lockedAt)throw Error('These grooming notes are locked. Choose a newer appointment to record a new haircut.');
 if(n.revision!==b.revision)throw Error('Another employee updated these notes. Your changes are retained; reload before applying them.');
 const source=b.sourceId?await tx.groomingNote.findFirst({where:{id:String(b.sourceId),tenantId,petId:n.petId,customerId:n.customerId}}):null;
 if(b.sourceId&&!source)throw Error('Choose a grooming record for this dog.');
 const instructions=validInstructions(source?.instructions||b.instructions),usual=b.usual===undefined?n.usual:b.usual;if(typeof usual!=='boolean')throw Error('Choose whether this is the usual haircut.');
 const changes=noteFields.filter(k=>(n.instructions as any)[k]!==instructions[k]).map(k=>({field:k,label:noteLabels[k],previous:(n.instructions as any)[k],value:instructions[k]}));
 if(usual!==n.usual)changes.push({field:'usual' as any,label:'Usual haircut',previous:n.usual,value:usual as any});
 const record=await tx.groomingNote.update({where:{id:n.id},data:{instructions,usual,usualAt:usual?(n.usualAt||new Date()):null,revision:{increment:1}}});
 const pet=await tx.pet.findFirst({where:{id:n.petId,tenantId}});
 for(const change of changes)await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'TICKET',entityId:n.ticketId,customerId:n.customerId,action:'GROOMING_NOTES',summary:`${pet?.name||'Pet'} — ${change.label}: ${String(change.previous??'—')} → ${String(change.value??'—')}`,details:{petId:n.petId,...change,sourceTicketId:source?.ticketId||null}}});
 if(source)await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'TICKET',entityId:n.ticketId,customerId:n.customerId,action:'GROOMING_NOTES_COPY',summary:`${pet?.name||'Pet'}: copied grooming instructions from a previous appointment.`,details:{sourceTicketId:source.ticketId,sourceRecordId:source.id}}});
 return {record};
 },{timeout:30000});return NextResponse.json(result);
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:409})}
}
