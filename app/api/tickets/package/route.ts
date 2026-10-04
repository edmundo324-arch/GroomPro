import {identifyPackageLines} from '@/src/lib/package-identification';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {resolveSaleLines} from '@/src/lib/pos-lines';
import {ticketDuration} from '@/src/lib/ticket-timing';
import {appointmentHoursError} from '@/src/lib/location-hours';
import {writeAudit} from '@/src/lib/audit';
export async function POST(r:NextRequest){
 const tenantId=r.headers.get('x-tenant-id')||process.env.GROOMPRO_DEV_TENANT_ID||'',sid=r.cookies.get('groompro_session')?.value;
 const session=tenantId&&sid?await getActiveEmployeeSession(tenantId,sid):null;if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 try{const b=await r.json();if(typeof b.present!=='boolean'||!b.packageId||!b.petId||!b.ticketId)throw Error('Ticket, dog, package and desired selection are required.');
 const result=await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${b.ticketId} AND tenantId=${tenantId} FOR UPDATE`;
 const ticket=await tx.ticket.findFirst({where:{id:b.ticketId,tenantId},include:{pets:true,lines:{include:{service:true}}}});if(!ticket||['CLOSED','CANCELLED','NO_SHOW'].includes(ticket.status))throw Error('Choose an open ticket.');
 if(!ticket.pets.some(p=>p.petId===b.petId))throw Error('Choose a dog on this ticket.');
 const packages=await tx.package.findMany({where:{tenantId},include:{items:{include:{service:true}}}});ticket.lines=identifyPackageLines(ticket.lines,packages);
 const existing=ticket.lines.filter(l=>l.packageId===b.packageId&&l.petId===b.petId);
 if(Boolean(existing.length)===b.present)return {changed:false};
 const remaining=ticket.lines.filter(l=>!existing.some(e=>e.id===l.id));
 const addition=b.present?await resolveSaleLines(tx,tenantId,[{type:'PACKAGE',id:b.packageId,petId:b.petId}],ticket.pets.map(p=>p.petId),ticket.locationId):{lines:[]};
 const durationMin=ticketDuration([...remaining,...addition.lines],ticket.timingMode);
 if(ticket.scheduledStart){const error=await appointmentHoursError(tenantId,ticket.locationId,ticket.scheduledStart,durationMin);if(error)throw Error(error)}
 if(!b.present)await tx.ticketLine.deleteMany({where:{ticketId:ticket.id,id:{in:existing.map(l=>l.id)}}});
 for(const line of addition.lines)await tx.ticketLine.create({data:{...line,ticketId:ticket.id,sortOrder:remaining.length+line.sortOrder}});
 await tx.ticket.update({where:{id:ticket.id},data:{durationMin}});return{changed:true};});
 if(result.changed)await writeAudit({tenantId,actorUserId:session.user.id,entityType:'TICKET',entityId:b.ticketId,action:b.present?'ADD_PACKAGE':'REMOVE_PACKAGE',summary:b.present?'Added pet package.':'Removed pet package.',details:{petId:b.petId,packageId:b.packageId}});
 return NextResponse.json(result);
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Package could not update.'},{status:400})}
}
