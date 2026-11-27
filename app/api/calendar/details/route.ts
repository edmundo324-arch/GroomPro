import {popupPetMemberships} from '@/src/lib/popup-pet-memberships';
import {attendingPets} from '@/src/lib/appointment-pets';
import {appointmentPreviewTicket} from '@/src/lib/appointment-preview';
import {groomingSummary} from '@/src/lib/grooming-notes-rules';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {employeeAppearance} from '@/src/lib/appearance-settings';
import {platformSession} from '@/src/lib/platform-access';
import {buildHoverDetails} from '@/src/lib/calendar-hover-details';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {requestLocation} from '@/src/lib/request-location';
async function handlePolicyGET(r:NextRequest){
 const tenantId=r.headers.get('x-tenant-id')||process.env.GROOMPRO_DEV_TENANT_ID||'',locationId=tenantId?await requestLocation(r,tenantId):null;
 if(!tenantId||!locationId)return NextResponse.json({error:'Business context required.'},{status:401});
 const ticket=await db.ticket.findFirst({where:{id:r.nextUrl.searchParams.get('id')||'',tenantId,locationId},include:{customer:{include:{phones:true}},pets:{include:{pet:{include:{vaccinations:true}}}},lines:{include:{service:{select:{name:true,category:true}}}},payments:true,assignments:{include:{user:{select:{displayName:true,firstName:true,lastName:true}}}}}});
 if(!ticket)return NextResponse.json({error:'Appointment not found.'},{status:404});
 const session=await platformSession(r);const fields=(await employeeAppearance(tenantId,session?.user)).hoverFields;
 const showVip=fields.includes('pet.vipEligible')||fields.includes('customer.vipStatus');
 const [withMemberships,notes,location]=await Promise.all([
  showVip?popupPetMemberships(db,tenantId,ticket):Promise.resolve(ticket),
  fields.includes('todayNotes')?db.groomingNote.findMany({where:{tenantId,ticketId:ticket.id},select:{petId:true,instructions:true}}):Promise.resolve([]),
  db.location.findFirst({where:{id:locationId,tenantId},select:{timezone:true}}),
 ]);
 const full=attendingPets({...withMemberships,pets:withMemberships.pets.map((entry:any)=>({...entry,pet:{...entry.pet,todaysGroomingNotes:groomingSummary(notes.find(note=>note.petId===entry.pet.id)?.instructions)}}))});
 const details=buildHoverDetails(full,fields);
 return NextResponse.json({details,ticket:appointmentPreviewTicket(full,fields,location?.timezone)},{headers:{'Cache-Control':'no-store'}});
}

export const GET=withRequestPolicy(handlePolicyGET, {feature:'CALENDAR'});
