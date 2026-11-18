import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {requestLocation} from '@/src/lib/request-location';
import {ticketReceipt} from '@/src/lib/ticket-receipt';
async function get(request:NextRequest){
 const session=await platformSession(request);
 if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 const tenantId=session.tenantId,locationId=await requestLocation(request,tenantId);
 const ticket=await db.ticket.findFirst({where:{id:request.nextUrl.searchParams.get('ticketId')||'',tenantId,locationId},include:{tenant:{select:{name:true}},location:{select:{name:true,timezone:true}},customer:{select:{firstName:true,lastName:true}},lines:{include:{pet:{select:{name:true}}},orderBy:{sortOrder:'asc'}},payments:{orderBy:{paidAt:'asc'}}}});
 if(!ticket||!locationId)return NextResponse.json({error:'This ticket could not be found at the selected location.'},{status:404});
 return NextResponse.json({html:ticketReceipt(ticket)},{headers:{'Cache-Control':'no-store'}});
}
export const GET=withRequestPolicy(get,{feature:'TICKETS'});
