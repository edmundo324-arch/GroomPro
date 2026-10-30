import {popupPetMemberships} from '@/src/lib/popup-pet-memberships';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {employeeAppearance} from '@/src/lib/appearance-settings';
import {platformSession} from '@/src/lib/platform-access';
import {buildHoverDetails} from '@/src/lib/calendar-hover-details';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {requestLocation} from '@/src/lib/request-location';
import {workflowSettings} from '@/src/lib/workflow-settings';
import {calendarHoverFields} from '@/src/lib/calendar-hover-fields';
async function handlePolicyGET(r:NextRequest){
 const tenantId=r.headers.get('x-tenant-id')||process.env.GROOMPRO_DEV_TENANT_ID||'',locationId=tenantId?await requestLocation(r,tenantId):null;
 if(!tenantId||!locationId)return NextResponse.json({error:'Business context required.'},{status:401});
 const ticket=await db.ticket.findFirst({where:{id:r.nextUrl.searchParams.get('id')||'',tenantId,locationId},include:{customer:{include:{phones:true}},pets:{include:{pet:{include:{vaccinations:true}}}},lines:true,payments:true,assignments:{include:{user:{select:{displayName:true,firstName:true,lastName:true}}}}}});
 if(!ticket)return NextResponse.json({error:'Appointment not found.'},{status:404});
 const session=await platformSession(r);const fields=(await employeeAppearance(tenantId,session?.user)).hoverFields;
 const showVip=fields.includes('pet.vipEligible')||fields.includes('customer.vipStatus');
 const details=buildHoverDetails(showVip?await popupPetMemberships(db,tenantId,ticket):ticket,fields);
 return NextResponse.json({details},{headers:{'Cache-Control':'no-store'}});
}

export const GET=withRequestPolicy(handlePolicyGET, {feature:'CALENDAR'});
