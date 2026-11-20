import {createHash} from 'node:crypto';
import {sendCustomerEmail} from '@/src/lib/customer-email';
import {writeAudit} from '@/src/lib/audit';
import {moduleDenial} from '@/src/lib/module-entitlement';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {requestLocation} from '@/src/lib/request-location';
import {ticketReceipt} from '@/src/lib/ticket-receipt';
async function handle(request:NextRequest){
 const session=await platformSession(request);
 if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 const tenantId=session.tenantId,locationId=await requestLocation(request,tenantId);
 const ticket=await db.ticket.findFirst({where:{id:request.nextUrl.searchParams.get('ticketId')||'',tenantId,locationId},include:{tenant:{select:{name:true}},location:{select:{name:true,timezone:true}},customer:{select:{firstName:true,lastName:true,email:true}},lines:{include:{pet:{select:{name:true}}},orderBy:{sortOrder:'asc'}},payments:{orderBy:{paidAt:'asc'}}}});
 if(!ticket||!locationId)return NextResponse.json({error:'This ticket could not be found at the selected location.'},{status:404});
 const receiptTicket={...ticket,promotionDisplay:(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:"PROMOTION_DISPLAY:"+ticket.id}}}))?.value||[]};
 const html=ticketReceipt(receiptTicket,true),revision=createHash('sha256').update(html+'\n'+(ticket.customer.email||'')).digest('hex');
 const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method==='GET')return reply({html:ticketReceipt(receiptTicket),email:ticket.customer.email,revision});
 const denial=await moduleDenial(request,'MESSAGING');if(denial)return denial;
 try{
  const body=await request.json();
  if(!/^[0-9a-f-]{36}$/i.test(body.requestId||''))return reply({error:'Reopen the email receipt action before sending.'},400);
  if(body.revision!==revision)return reply({error:'The saved ticket or email address changed. Reopen the email receipt action to review it.'},409);
  if(!ticket.customer.email)return reply({error:'Add the customer’s email address in Customer Profile → Details, then try again.'},400);
  const id='receipt_'+createHash('sha256').update(tenantId+':'+ticket.id+':'+body.requestId).digest('hex').slice(0,40);
  const result=await sendCustomerEmail({tenantId,customerId:ticket.customerId,body:`${ticket.tenant.name}: your invoice or receipt for ticket #${ticket.orderNumber} is included in this email. It reflects the saved ticket at the time this copy was requested.`,document:{id,ticketId:ticket.id,subject:`${ticket.tenant.name} · Ticket #${ticket.orderNumber}`,html,expectedEmail:ticket.customer.email}});
  await writeAudit({tenantId,actorUserId:session.user.id,entityType:'COMMUNICATION',entityId:result.communication.id,customerId:ticket.customerId,action:'RECEIPT_EMAIL_'+result.communication.deliveryStatus,summary:result.message,details:{ticketId:ticket.id}});
  return reply({message:result.message,status:result.communication.deliveryStatus});
 }catch{return reply({error:'We could not confirm the receipt email. Check Customer Profile → Communication History before sending another copy.'},400);}
}
export const GET=withRequestPolicy(handle,{feature:'TICKETS'});
export const POST=withRequestPolicy(handle,{feature:'TICKETS'});
