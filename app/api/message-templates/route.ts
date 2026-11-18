import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {renderMessageTemplate} from '@/src/lib/message-templates';
async function handle(r:NextRequest){
 const session=await platformSession(r);
 if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 const reply=(value:object,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
 try{
  const input=r.method==='POST'?await r.json():Object.fromEntries(r.nextUrl.searchParams);
  const tenantId=session.tenantId;
  const saved=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'BUSINESS_LIBRARY:message-templates'}}});
  const templates=((saved?.value as any)?.rows||[]).filter((row:any)=>row.active!==false&&row.channel===input.channel);
  if(!input.customerId)return reply({templates,appointments:[]});
  const customer=await db.customer.findFirst({where:{tenantId,id:String(input.customerId)},include:{pets:{where:{active:true}},tenant:{select:{name:true}}}});
  if(!customer)return reply({error:'This customer is unavailable at this shop. Choose another customer.'},404);
  const include={location:{select:{name:true,timezone:true}},pets:{include:{pet:{select:{name:true}}}}};
  if(r.method==='GET'){
   const appointments=await db.ticket.findMany({where:{tenantId,customerId:customer.id,scheduledStart:{not:null}},include,orderBy:{scheduledStart:'desc'},take:100});
   return reply({templates,appointments:appointments.map(t=>({id:t.id,label:`#${t.orderNumber} · ${t.scheduledStart?.toLocaleString('en-US',{timeZone:t.location.timezone})} · ${t.status}`}))});
  }
  const template=templates.find((row:any)=>row.id===input.templateId);
  if(!template)throw Error('This saved message is unavailable. Choose another template.');
  const ticket=input.ticketId?await db.ticket.findFirst({where:{tenantId,customerId:customer.id,id:String(input.ticketId)},include}):null;
  if(input.ticketId&&!ticket)return reply({error:'This appointment does not belong to the selected customer or shop.'},404);
  const date=ticket?.scheduledStart,zone=ticket?.location.timezone;
  const body=renderMessageTemplate(template.text,{business:customer.tenant.name,customer:[customer.firstName,customer.lastName].filter(Boolean).join(' '),firstName:customer.firstName,pets:(ticket?ticket.pets.map(p=>p.pet):customer.pets).map(p=>p.name).join(', '),location:ticket?.location.name,appointmentDate:date?.toLocaleDateString('en-US',{timeZone:zone,dateStyle:'full'}),appointmentTime:date?.toLocaleTimeString('en-US',{timeZone:zone,timeStyle:'short'})},template.channel);
  return reply({body});
 }catch(e){return reply({error:e instanceof Error?e.message:'Could not prepare this message. Please try again.'},400);}
}
export const GET=withRequestPolicy(handle,{feature:'MESSAGING'});
export const POST=withRequestPolicy(handle,{feature:'MESSAGING'});
