import {responsibleEmployee} from '@/src/lib/pet-scheduling';
import {NextRequest,NextResponse} from 'next/server';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {db} from '@/src/lib/db';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {requestLocation} from '@/src/lib/request-location';
import {approvedScheduling} from '@/src/lib/scheduling-authorization';
import {warningDetails} from '@/src/lib/scheduling-warning';
import {checkPlannedPackages,readPlannedPackages,writePlannedPackages} from '@/src/lib/planned-package-store';
import {plannedKey} from '@/src/lib/planned-package-rules';
async function patch(r:NextRequest){const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'',sid=r.cookies.get('groompro_session')?.value,session=sid?await getActiveEmployeeSession(tenantId,sid):null;if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 try{const b=await r.json(),locationId=await requestLocation(r,tenantId),allow=await approvedScheduling(r,'Choose an available employee or Assign later.');
 if(!locationId)throw Error('Select a location for this appointment.');
 const items=await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM Ticket WHERE tenantId=${tenantId} AND id=${String(b.ticketId||'')} FOR UPDATE`;const ticket=await tx.ticket.findFirst({where:{id:String(b.ticketId||''),tenantId,locationId},include:{pets:true,lines:true,assignments:true}});if(!ticket)throw Error('Appointment not found.');if(['CLOSED','CANCELLED','NO_SHOW'].includes(ticket.status))throw Error('This appointment is closed.');if(responsibleEmployee(ticket.lines,b.assignment?.petId))throw Error('Change this dog’s actual employee through its service lines.');
 const [next]=await checkPlannedPackages(tenantId,ticket,[b.assignment],allow,tx),previous=await readPlannedPackages(tenantId,ticket.id,tx);const items=[...previous.filter(p=>next.packageKey?plannedKey(p)!==plannedKey(next):p.petId!==next.petId),next];await writePlannedPackages(tx,tenantId,ticket.id,items,ticket,previous);await tx.ticket.update({where:{id:ticket.id},data:{updatedAt:new Date()}});await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'TICKET',entityId:ticket.id,customerId:ticket.customerId,action:'PLANNED_PACKAGE_EMPLOYEE',summary:'Changed a dog’s planned package employee.',details:{previous,assignment:next}}});return items;});return NextResponse.json({items});
 }catch(e){return NextResponse.json({...warningDetails(e),error:(e as Error).message},{status:409})}}
export const PATCH=withRequestPolicy(patch,{feature:'TICKETS'});
