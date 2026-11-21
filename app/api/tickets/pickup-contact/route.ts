import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {platformSession} from '@/src/lib/platform-access';
import {requestLocation} from '@/src/lib/request-location';
export const GET=withRequestPolicy(async(r:NextRequest)=>{
 const session=await platformSession(r);if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 const tenantId=session.tenantId,locationId=await requestLocation(r,tenantId);
 const ticket=locationId&&await db.ticket.findFirst({where:{id:r.nextUrl.searchParams.get('ticketId')||'',tenantId,locationId},select:{id:true,status:true,pickupAt:true,pickupCompletedAt:true,customer:{select:{firstName:true,lastName:true,phones:{orderBy:{isPrimary:'desc'},select:{id:true,number:true}}}}}});
 if(!ticket)return NextResponse.json({error:'This appointment is not available at this shop.'},{status:404});
 return NextResponse.json({customer:[ticket.customer.firstName,ticket.customer.lastName].join(' '),phones:ticket.customer.phones,canRecord:ticket.status==='READY'&&!!ticket.pickupAt&&!ticket.pickupCompletedAt},{headers:{'Cache-Control':'no-store'}});
},{feature:'TICKETS'});
