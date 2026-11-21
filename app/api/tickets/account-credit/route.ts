import {withRequestPolicy} from '@/src/lib/request-policy';
import {NextRequest,NextResponse} from 'next/server';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {applyTicketCredit} from '@/src/lib/ticket-credit';
async function handle(request:NextRequest){const tenantId=request.headers.get('x-tenant-id')||process.env.GROOMPRO_DEV_TENANT_ID||'',sid=request.cookies.get('groompro_session')?.value||'',session=tenantId&&sid?await getActiveEmployeeSession(tenantId,sid):null;if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});try{const body=await request.json();return NextResponse.json(await applyTicketCredit(tenantId,session.user.id,String(body.ticketId||''),Math.round(Number(body.amountCents)),undefined,body.operationId));}catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}}
export const POST=withRequestPolicy(handle,{feature:'TICKETS'});
