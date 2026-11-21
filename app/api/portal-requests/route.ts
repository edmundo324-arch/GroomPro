import {unfinishedBookings,reviewUnfinishedBooking} from '@/src/lib/unfinished-bookings';
import {queueInitialAttendanceRequest} from '@/src/lib/appointment-message-acceptance';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {reviewCancellation,type CancellationRequest} from '@/src/lib/portal-requests';
async function handle(r:NextRequest){
 const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
 const sid=r.cookies.get('groompro_session')?.value,session=sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});
 const canReviewFees=['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role);
 if(r.method==='GET'){
  const permission=canReviewFees?null:await db.rolePermission.findUnique({where:{tenantId_role_permissionCode:{tenantId,role:session.user.role,permissionCode:'EDIT'}}});
  const rows=await db.tenantSetting.findMany({where:{tenantId,OR:[{settingKey:{startsWith:'PORTAL_CANCELLATION:'}},{settingKey:{startsWith:'PORTAL_CHANGE:'}}]}});
  const pending=rows.filter(row=>(row.value as unknown as CancellationRequest)?.state==='PENDING');
  const tickets=await db.ticket.findMany({where:{tenantId,id:{in:pending.map(row=>row.settingKey.slice(row.settingKey.indexOf(':')+1))}},select:{id:true,orderNumber:true,scheduledStart:true,customer:{select:{firstName:true,lastName:true}},location:{select:{name:true,timezone:true}}}});
  const bookings=await db.ticket.findMany({where:{tenantId,bookingSource:'ONLINE',bookingDecision:{in:['REQUESTED','PENDING']},status:{in:['OPEN','CONFIRMED']}},select:{id:true,orderNumber:true,scheduledStart:true,requestedAt:true,customer:{select:{firstName:true,lastName:true}},location:{select:{name:true,timezone:true}}}});
  return NextResponse.json({unfinishedBookings:await unfinishedBookings(tenantId),requests:[...bookings.map(ticket=>({...ticket,kind:'BOOKING',request:{requestedAt:ticket.requestedAt,message:'Online booking awaiting shop acceptance.'}})),...pending.flatMap(row=>{const ticket=tickets.find(t=>t.id===row.settingKey.slice(row.settingKey.indexOf(':')+1));return ticket?[{...ticket,kind:row.settingKey.startsWith('PORTAL_CHANGE:')?'CHANGE':'CANCELLATION',request:row.value}]:[]})],canReview:permission?.enabled!==false,canReviewFees},{headers:{'Cache-Control':'no-store'}});
 }
 try{const b=await r.json();if(b.kind==='UNFINISHED'){await reviewUnfinishedBooking(tenantId,String(b.attemptId||''),session.user.id,String(b.lastActivityAt||''));return NextResponse.json({reviewed:true});}if(b.kind==='BOOKING'){
 if(typeof b.ticketId!=='string'||typeof b.accept!=='boolean')throw Error('Choose whether to accept this booking.');
 await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${b.ticketId} AND tenantId=${tenantId} FOR UPDATE`;
  const ticket=await tx.ticket.findFirst({where:{id:b.ticketId,tenantId,bookingSource:'ONLINE'}});if(!ticket)throw Error('Booking request not found.');
  if(!['REQUESTED','PENDING'].includes(ticket.bookingDecision))return;
  if(!['OPEN','CONFIRMED'].includes(ticket.status)||ticket.checkedInAt)throw Error('This booking changed. Review it in POS first.');
  await tx.ticket.update({where:{id:ticket.id},data:{status:b.accept?'OPEN':'CANCELLED',bookingDecision:b.accept?'ACCEPTED':'REJECTED'}});
  if(b.accept)await queueInitialAttendanceRequest(tx,{...ticket,status:'OPEN',bookingDecision:'ACCEPTED'});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'TICKET',entityId:ticket.id,customerId:ticket.customerId,action:'ONLINE_BOOKING_REVIEW',details:{decision:b.accept?'ACCEPTED':'REJECTED',scheduledStart:ticket.scheduledStart?.toISOString()||null},summary:b.accept?'Accepted online booking request.':'Declined online booking request.'}});
 });return NextResponse.json({reviewed:true});
 }if(b.kind==='CHANGE'){if(typeof b.ticketId!=='string'||typeof b.reason!=='string'||!b.reason.trim())throw Error('Enter how the request was handled.');await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${b.ticketId} AND tenantId=${tenantId} FOR UPDATE`;const ticket=await tx.ticket.findFirst({where:{id:b.ticketId,tenantId}});if(!ticket)throw Error('Appointment not found.');const where={tenantId_settingKey:{tenantId,settingKey:'PORTAL_CHANGE:'+b.ticketId}},row=await tx.tenantSetting.findUnique({where});if((row?.value as any)?.state!=='PENDING')return;const value={...(row!.value as any),state:'REVIEWED',resolvedAt:new Date().toISOString(),resolution:b.reason.trim().slice(0,2000)};await tx.tenantSetting.update({where,data:{value}});await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'TICKET',entityId:ticket.id,customerId:ticket.customerId,action:'CUSTOMER_CHANGE_REVIEW',summary:'Reviewed customer appointment-change request.',details:value}})});return NextResponse.json({reviewed:true});}if(!canReviewFees)return NextResponse.json({error:'Ask an owner or manager to review the cancellation fee.'},{status:403});if(typeof b.ticketId!=='string'||typeof b.reason!=='string'||typeof b.waive!=='boolean')throw Error('Choose the appointment and enter a review reason.');return NextResponse.json({request:await reviewCancellation(tenantId,b.ticketId,session.user.id,b.waive,b.reason,{keepAppointment:b.keepAppointment===true,expectedStart:b.expectedStart})});}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}
}
export const GET=withRequestPolicy(handle,{feature:'TICKETS'});
export const PATCH=withRequestPolicy(handle,{feature:'TICKETS'});
