import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {confirmationNotice,queueConfirmationRequest} from '@/src/lib/confirmation-requests';
import {runAppointmentMessages} from '@/src/lib/appointment-message-runner';
async function handle(request:NextRequest){
 const session=await platformSession(request);if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});
 try{const input=request.method==='GET'?{ticketId:request.nextUrl.searchParams.get('ticketId')}:await request.json();
  if(typeof input.ticketId!=='string'||!input.ticketId||input.ticketId.length>191)throw Error('Open a saved appointment before reviewing reminders.');
  if(request.method==='GET')return NextResponse.json(await confirmationNotice(db,session.tenantId,input.ticketId),{headers:{'Cache-Control':'no-store'}});
  if(typeof input.operationId!=='string'||!/^[a-f0-9-]{36}$/i.test(input.operationId)||typeof input.scheduledStart!=='string')throw Error('Reopen the reminder action before trying again.');
  const queued=await queueConfirmationRequest(db,session.tenantId,session.user.id,{ticketId:input.ticketId,scheduledStart:input.scheduledStart,operationId:input.operationId});
  await runAppointmentMessages(null,{tenantId:session.tenantId,ticketId:input.ticketId,requestAt:queued.requestAt});
  return NextResponse.json({message:'Confirmation request recorded. Communication History shows whether each message was accepted or needs attention.'},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({error:(error as Error).message},{status:400});}
}
export const GET=withRequestPolicy(handle,{feature:'TICKETS'});
export const POST=withRequestPolicy(handle,{feature:'MESSAGING'});
