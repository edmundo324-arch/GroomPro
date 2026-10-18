import {schedulingApproved,warningDetails} from '@/src/lib/scheduling-warning';
import {NextRequest,NextResponse} from 'next/server';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {setPlannedGroomer} from '@/src/lib/groomer-assignment';
import {writeAudit} from '@/src/lib/audit';
export async function PATCH(r:NextRequest){
 const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'',sid=r.cookies.get('groompro_session')?.value;
 const session=sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 try{const b=await r.json(),ticket=await setPlannedGroomer(tenantId,String(b.ticketId||''),b.userId?String(b.userId):null,schedulingApproved(r,'Choose an available groomer or Assign later.'));
 await writeAudit({tenantId,actorUserId:session.user.id,entityType:'TICKET',entityId:ticket.id,customerId:ticket.customerId,action:'PLANNED_GROOMER',summary:'Changed the planned groomer.',details:{previousUserIds:ticket.assignments.map(a=>a.userId),userId:b.userId||null}});
 return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({...warningDetails(e),error:(e as Error).message},{status:409})}
}
