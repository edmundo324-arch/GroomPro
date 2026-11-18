import {NextRequest,NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {calendarInvitation} from '@/src/lib/calendar-invitation';
async function invitation(r:NextRequest){
 const s=await platformSession(r);if(!s)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 try{const body=r.method==='POST'?await r.json():{},id=body.ticketId||r.nextUrl.searchParams.get('ticketId');if(typeof id!=='string'||!id)throw Error('Open the appointment before creating its invitation.');const ticket=await db.ticket.findFirst({where:{id,tenantId:s.tenantId},include:{customer:true,location:true,tenant:true}});if(!ticket)throw Error('This ticket is unavailable. Reopen it and try again.');
 if(!ticket.scheduledStart)throw Error('Set an appointment date and time before creating a calendar invitation.');
 const business=ticket.tenant.name,address=[ticket.location.address1,ticket.location.address2,ticket.location.city,ticket.location.state,ticket.location.postalCode].filter(Boolean).join(', '),ics=calendarInvitation({...ticket,scheduledStart:ticket.scheduledStart},business,address);
 if(r.method==='GET')return new NextResponse(ics,{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="appointment.ics"','Cache-Control':'no-store'}});
 if(!ticket.customer.email||!ticket.customer.appointmentEmail||ticket.customer.invalidEmail)throw Error('Review this customer’s email address and appointment-email preference before sending.');
 let config:any;try{config=JSON.parse(process.env.GROOMPRO_AGREEMENT_EMAIL_TENANTS_JSON||'{}')[s.tenantId]}catch{}
 if(!config?.apiKey||!config?.from)throw Error('Email delivery is not configured for this business. Download the calendar invitation instead.');
 const hash=createHash('sha256').update(ticket.id+'|'+ticket.updatedAt.toISOString()+'|'+ticket.customer.email).digest('hex');
 const attempt=await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${s.tenantId} FOR UPDATE`;const existing=await tx.communication.findFirst({where:{tenantId:s.tenantId,externalId:'calendar:'+hash}});if(existing)return {communication:existing,created:false};return {created:true,communication:await tx.communication.create({data:{tenantId:s.tenantId,customerId:ticket.customerId,ticketId:ticket.id,channel:'EMAIL',direction:'OUTBOUND',toAddress:ticket.customer.email,subject:'Your grooming appointment',body:'Your appointment at '+business+' is attached as a calendar invitation.',externalId:'calendar:'+hash,deliveryStatus:'PENDING'}})}});
 const communication=attempt.communication;
 if(!attempt.created){if(communication.deliveryStatus==='SENT')return NextResponse.json({message:'This version of the invitation has already been sent.'});throw Error('This invitation already has a sending attempt. Review its communication record before sending another copy. You can still download the invitation.');}
 let response:Response;
 try{
 response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.apiKey,'Content-Type':'application/json','Idempotency-Key':'calendar-'+hash},body:JSON.stringify({from:config.from,to:[ticket.customer.email],subject:communication.subject,text:communication.body,attachments:[{filename:'appointment.ics',content:Buffer.from(ics).toString('base64')}] }),signal:AbortSignal.timeout(12000)});
 }catch{await db.communication.update({where:{id:communication.id},data:{deliveryStatus:'UNKNOWN'}});throw Error('The email service did not confirm whether it accepted the invitation. Check its communication record before sending another copy.');}
 if(!response.ok){await db.communication.update({where:{id:communication.id},data:{deliveryStatus:'FAILED'}});throw Error('The email service did not accept the invitation. Review email delivery before trying again.');}
 await db.communication.update({where:{id:communication.id},data:{deliveryStatus:'SENT',sentAt:new Date()}});return NextResponse.json({message:'The email service accepted the calendar invitation. Delivery is not yet confirmed.'});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}
}
export const GET=withRequestPolicy(invitation,{feature:'TICKETS'});
export const POST=withRequestPolicy(invitation,{feature:'MESSAGING'});
