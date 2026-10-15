import {buildHoverDetails} from '@/src/lib/calendar-hover-details';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {requestLocation} from '@/src/lib/request-location';
import {workflowSettings} from '@/src/lib/workflow-settings';
import {calendarHoverFields} from '@/src/lib/calendar-hover-fields';
export async function GET(r:NextRequest){
 const tenantId=r.headers.get('x-tenant-id')||process.env.GROOMPRO_DEV_TENANT_ID||'',locationId=tenantId?await requestLocation(r,tenantId):null;
 if(!tenantId||!locationId)return NextResponse.json({error:'Business context required.'},{status:401});
 const ticket=await db.ticket.findFirst({where:{id:r.nextUrl.searchParams.get('id')||'',tenantId,locationId},include:{customer:{include:{phones:true}},pets:{include:{pet:{include:{vaccinations:true}}}},lines:true,payments:true,assignments:{include:{user:{select:{firstName:true,lastName:true}}}}}});
 if(!ticket)return NextResponse.json({error:'Appointment not found.'},{status:404});
 const fields=(await workflowSettings(tenantId)).hoverFields;
 const details=buildHoverDetails(ticket,fields);
 return NextResponse.json({details},{headers:{'Cache-Control':'no-store'}});
}
