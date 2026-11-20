import {NextRequest,NextResponse} from 'next/server';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {readTicketRefunds,recordTicketRefund} from '@/src/lib/ticket-refunds';
async function handle(request:NextRequest){
 const session=await platformSession(request);if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 if(!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role))return NextResponse.json({error:'Ask an owner or manager to review or record this refund.'},{status:403});
 try{const body=request.method==='GET'?{ticketId:request.nextUrl.searchParams.get('ticketId')}:await request.json(),ticketId=String(body.ticketId||'');if(!ticketId||ticketId.length>191)throw Error('Open the closed ticket to review its refunds.');
 return NextResponse.json(request.method==='GET'?await readTicketRefunds(session.tenantId,ticketId):await recordTicketRefund(session.tenantId,session.user.id,ticketId,body,'REVERSE'),{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({error:(error as Error).message},{status:400});}
}
export const GET=withRequestPolicy(handle,{feature:'TICKETS'});
export const POST=withRequestPolicy(handle,{feature:'TICKETS'});
