import {readCareInstructions} from '@/src/lib/grooming-instructions';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession,isPlatformAdmin,entitled} from '@/src/lib/platform-access';
import {requestLocation} from '@/src/lib/request-location';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {groomingExperienceFeature} from '@/src/lib/grooming-experience';
import {readCareProgress,saveCareProgress} from '@/src/lib/grooming-progress';
async function handle(r:NextRequest){const s=await platformSession(r);if(!s)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});
 const available=isPlatformAdmin(s)||await entitled(s.tenantId,groomingExperienceFeature);if(!available)return NextResponse.json(r.method==='GET'?{available:false}:{error:'This business’s subscription does not include the seven-stage grooming workflow.'},{status:r.method==='GET'?200:403});
 try{const locationId=await requestLocation(r,s.tenantId);if(!locationId)throw Error('Choose the shop for this ticket.');
 if(r.method==='PATCH'){const b=await r.json(),progress=await saveCareProgress(s.tenantId,locationId,s.user.id,b);return NextResponse.json({progress});}
 const ticketId=r.nextUrl.searchParams.get('ticketId')||'',ticket=await db.ticket.findFirst({where:{tenantId:s.tenantId,locationId,id:ticketId},include:{pets:{include:{pet:true}},lines:{include:{pet:true}}}});if(!ticket)throw Error('Choose a saved ticket at this shop.');
 const pets=[...new Map([...ticket.pets.map(p=>p.pet),...ticket.lines.map(l=>l.pet).filter((p):p is NonNullable<typeof p>=>!!p)].map(p=>[p.id,p])).values()];
 return NextResponse.json({available:true,stages:(await readCareInstructions(s.tenantId)).stages,timezone:(await db.location.findFirst({where:{tenantId:s.tenantId,id:locationId}}))?.timezone||'UTC',closed:['CLOSED','CANCELLED','VOIDED','NO_SHOW'].includes(ticket.status),pets:await Promise.all(pets.map(async p=>({id:p.id,name:p.name,progress:await readCareProgress(s.tenantId,ticketId,p.id)})))},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:409});}}
export const GET=withRequestPolicy(handle,{feature:'TICKETS'});
export const PATCH=withRequestPolicy(handle,{feature:'TICKETS'});
