import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {writeAudit} from '@/src/lib/audit';
export async function PATCH(r:NextRequest){
 const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
 const sid=r.cookies.get('groompro_session')?.value;const session=sid&&tenantId?await getActiveEmployeeSession(tenantId,sid):null;if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 try{const b=await r.json();const ticketId=String(b.ticketId||''),customerId=String(b.customerId||''),petId=String(b.petId||'');
 const ticket=await db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticketId} AND tenantId=${tenantId} FOR UPDATE`;
 const t=await tx.ticket.findFirst({where:{id:ticketId,tenantId},include:{payments:true}});if(!t)throw Error('Ticket not found.');
 if(['CLOSED','CANCELLED','NO_SHOW'].includes(t.status)||t.payments.length||t.accountCreditCents)throw Error('Customer changes require an open ticket without payments or applied credit.');
 const reward=await tx.$queryRaw<any[]>`SELECT id FROM CustomerRewardLedger WHERE tenantId=${tenantId} AND ticketId=${ticketId} LIMIT 1`;if(reward.length)throw Error('This ticket already has customer reward activity.');
 const pet=await tx.pet.findFirst({where:{id:petId,customerId,tenantId,active:true,customer:{active:true}}});if(!pet)throw Error('Choose a dog belonging to the new customer.');
 await tx.ticketLine.deleteMany({where:{ticketId,description:'Customer Account Balance'}});
 await tx.ticketLine.updateMany({where:{ticketId,petId:{not:null}},data:{petId}});
 await tx.ticketPet.deleteMany({where:{ticketId}});await tx.ticketPet.create({data:{ticketId,petId}});
 return tx.ticket.update({where:{id:ticketId},data:{customerId}});
 });await writeAudit({tenantId,actorUserId:session.user.id,entityType:'TICKET',entityId:ticketId,customerId,action:'CHANGE_CUSTOMER',summary:`Changed customer on ticket #${ticket.orderNumber}.`,details:{petId}});return NextResponse.json({ticket});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Customer could not change.'},{status:400})}
}
