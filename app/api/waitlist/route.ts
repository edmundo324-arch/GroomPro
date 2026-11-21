import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {readPortalPolicy} from '@/src/lib/portal-policy-store';
import {joinWaitlist,readWaitlist,changeWaitlist,waitlistOpenings} from '@/src/lib/waitlist';
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function handle(r:NextRequest){const session=await platformSession(r);if(!session)return reply({error:'Enter your employee PIN.'},401);const tenantId=session.tenantId;
 try{if(r.method==='GET'){
  const customerId=r.nextUrl.searchParams.get('customerId');if(customerId){const customer=await db.customer.findFirst({where:{tenantId,id:customerId,active:true},select:{id:true,firstName:true,lastName:true,pets:{where:{tenantId,active:true},select:{id:true,name:true}}}});if(!customer)return reply({error:'This customer is unavailable.'},404);
   const policy=await readPortalPolicy(tenantId);const [services,packages,locations]=await Promise.all([db.service.findMany({where:{tenantId,active:true,id:{in:policy.bookableItems.filter(k=>k.startsWith('SERVICE:')).map(k=>k.slice(8))}},select:{id:true,name:true,description:true}}),db.package.findMany({where:{tenantId,active:true,id:{in:policy.bookableItems.filter(k=>k.startsWith('PACKAGE:')).map(k=>k.slice(8))}},select:{id:true,name:true,description:true}}),db.location.findMany({where:{tenantId},select:{id:true,name:true}})]);return reply({customer,locations,catalog:[...services.map(s=>({...s,key:'SERVICE:'+s.id})),...packages.map(p=>({...p,key:'PACKAGE:'+p.id}))]});}
  const rows=await readWaitlist(tenantId),id=r.nextUrl.searchParams.get('id');if(id){const entry=rows.find(v=>v.id===id);if(!entry)return reply({error:'This waitlist entry is unavailable.'},404);if(r.nextUrl.searchParams.get('appointments')==='true'){const appointments=await db.ticket.findMany({where:{tenantId,customerId:entry.customerId,locationId:entry.locationId,status:{notIn:['CANCELLED','NO_SHOW']},bookingDecision:{notIn:['REQUESTED','PENDING']},scheduledStart:{not:null}},select:{id:true,orderNumber:true,scheduledStart:true,status:true},orderBy:{scheduledStart:'desc'},take:50});return reply({appointments,timezone:entry.location.timezone});}return reply(await waitlistOpenings(tenantId,entry,r.nextUrl.searchParams.get('date')||''));}return reply({rows});
 }
 const b=await r.json();if(r.method==='POST')return reply({entry:await joinWaitlist(tenantId,String(b.customerId||''),String(b.locationId||''),b,session.user.id)});
 return reply({entry:await changeWaitlist(tenantId,String(b.customerId||''),String(b.id||''),b.revision,String(b.action||''),session.user.id,b.ticketId)});
 }catch(e){return reply({error:(e as Error).message},400);}
}
export const GET=withRequestPolicy(handle,{feature:'TICKETS'});
export const POST=withRequestPolicy(handle,{feature:'TICKETS'});
export const PATCH=withRequestPolicy(handle,{feature:'TICKETS'});
