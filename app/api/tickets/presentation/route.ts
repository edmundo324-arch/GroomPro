import {withRequestPolicy} from '@/src/lib/request-policy';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {requestLocation} from '@/src/lib/request-location';
import {workflowSettings} from '@/src/lib/workflow-settings';
import {petServiceTypesKey,serviceTypes} from '@/src/lib/calendar-presentation';

async function patch(request:NextRequest){
 const session=await platformSession(request);
 if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 const {tenantId}=session,locationId=await requestLocation(request,tenantId);
 const {ticketId,petId,serviceType}=await request.json();
 const settings=await workflowSettings(tenantId);
 if(typeof serviceType!=='string'||serviceType&&![...serviceTypes,...settings.customServiceTypes].includes(serviceType))
  return NextResponse.json({error:'Choose a configured service type.'},{status:400});
 try{
  const petServiceTypes=await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${String(ticketId)} AND tenantId=${tenantId} FOR UPDATE`;
   const ticket=await tx.ticket.findFirst({where:{id:String(ticketId),tenantId,locationId},include:{pets:true}});
   if(!ticket||petId!==undefined&&!ticket.pets.some(pet=>pet.petId===petId))throw Error('Choose a dog booked on this ticket.');
   if(['CLOSED','CANCELLED','NO_SHOW'].includes(ticket.status))throw Error('This appointment is closed.');
   if(petId===undefined){
    await tx.ticket.update({where:{id:ticket.id},data:{presentationServiceType:serviceType||null}});
    await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,customerId:ticket.customerId,entityType:'TICKET',entityId:ticket.id,action:'PRESENTATION',summary:'Updated appointment service type.',details:{previous:ticket.presentationServiceType,value:serviceType||null}}});
    return {};
   }
   const settingKey=petServiceTypesKey(ticket.id),where={tenantId_settingKey:{tenantId,settingKey}};
   const row=await tx.tenantSetting.findUnique({where});
   const value={...(row?.value as Record<string,string>||{})},previous=value[petId]||null;
   if(serviceType)value[petId]=serviceType;else delete value[petId];
   await tx.tenantSetting.upsert({where,create:{tenantId,settingKey,value},update:{value}});
   await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,customerId:ticket.customerId,entityType:'TICKET',entityId:ticket.id,action:'PRESENTATION',summary:'Updated a dog’s service type.',details:{petId,previous,value:serviceType||null}}});
   return value;
  });
  return NextResponse.json({ok:true,petServiceTypes});
 }catch(error){return NextResponse.json({error:(error as Error).message},{status:409});}
}
export const PATCH=withRequestPolicy(patch,{feature:'TICKETS'});
