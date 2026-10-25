import {withRequestPolicy} from '@/src/lib/request-policy';
import {ensureGroomingNotes} from '@/src/lib/grooming-notes-store';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {writeAudit} from '@/src/lib/audit';
async function handlePolicyPATCH(r:NextRequest){
 const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'',sid=r.cookies.get('groompro_session')?.value;
 const session=sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 try{const b=await r.json();if(typeof b.included!=='boolean')throw Error('Choose whether to include this dog.');
 const ticket=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${String(b.ticketId)} AND tenantId=${tenantId} FOR UPDATE`;
  const t=await tx.ticket.findFirst({where:{id:String(b.ticketId),tenantId,status:{notIn:['CLOSED','CANCELLED','NO_SHOW']}}});
  if(!t)throw Error('Open ticket not found.');
  const pet=await tx.pet.findFirst({where:{id:String(b.petId),tenantId,customerId:t.customerId,active:true}});if(!pet)throw Error('Choose a dog belonging to this customer.');
  if(b.included)await tx.ticketPet.upsert({where:{ticketId_petId:{ticketId:t.id,petId:pet.id}},create:{ticketId:t.id,petId:pet.id},update:{}});
  else {if(await tx.ticketLine.count({where:{ticketId:t.id,petId:pet.id}}))throw Error('Remove this dog’s service lines before removing the dog.');await tx.ticketPet.deleteMany({where:{ticketId:t.id,petId:pet.id}});}
  if(b.included)await ensureGroomingNotes(tx,{...t,pets:[{petId:pet.id}]},session.user.id);
  return t;
 });
 await writeAudit({tenantId,actorUserId:session.user.id,entityType:'TICKET',entityId:ticket.id,customerId:ticket.customerId,action:'TICKET_PET',summary:'Updated the dogs included on the ticket.',details:{petId:b.petId,included:b.included}});
 return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:409})}
}

export const PATCH=withRequestPolicy(handlePolicyPATCH, {feature:'TICKETS'});
