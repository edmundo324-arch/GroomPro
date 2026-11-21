import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {ticketFollowUps,stopTicketFollowUp} from '@/src/lib/ticket-follow-ups';
async function handle(r:NextRequest){const session=await platformSession(r);if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});try{const input=r.method==='GET'?{ticketId:r.nextUrl.searchParams.get('ticketId')}:await r.json();if(typeof input.ticketId!=='string'||!input.ticketId||input.ticketId.length>191)throw Error('Open a saved ticket to review its follow-ups.');const data=r.method==='GET'?await ticketFollowUps(db,session.tenantId,input.ticketId):await stopTicketFollowUp(db,session.tenantId,session.user.id,input);return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
export const GET=withRequestPolicy(handle,{feature:'TICKETS'});
export const PATCH=withRequestPolicy(handle,{feature:'TICKETS'});
