import {NextRequest,NextResponse} from 'next/server';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {platformSession} from '@/src/lib/platform-access';
import {db} from '@/src/lib/db';

async function patch(request:NextRequest){
 const session=await platformSession(request);
 if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 const {petId,customerId,recorded}=await request.json();
 if(typeof petId!=='string'||typeof customerId!=='string'||typeof recorded!=='boolean')
  return NextResponse.json({error:'Choose a customer and dog.'},{status:400});
 const {tenantId}=session;
 const pet=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Pet WHERE tenantId=${tenantId} AND id=${petId} FOR UPDATE`;
  const current=await tx.pet.findFirst({where:{id:petId,customerId,tenantId}});
  if(!current)return null;
  const careFlags={...(current.careFlags as Record<string,any>||{}),vipConversationAt:recorded?new Date().toISOString():null};
  const updated=await tx.pet.update({where:{id:petId},data:{careFlags},select:{id:true,careFlags:true}});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'PET',entityId:petId,customerId,action:'VIP_CONVERSATION',summary:recorded?'Recorded VIP sales conversation.':'Cleared VIP sales conversation marker.',details:{recorded}}});
  return updated;
 });
 return pet?NextResponse.json({pet}):NextResponse.json({error:'Dog not found.'},{status:404});
}
export const PATCH=withRequestPolicy(patch,{feature:'TICKETS'});
