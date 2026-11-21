import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {voidTicket,voidEligibility,voidRoles,mayVoid,ticketVoidKey,ticketVoidPolicyKey} from '@/src/lib/ticket-void';
async function handle(r:NextRequest){const session=await platformSession(r);if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});try{const input=r.method==='GET'?{ticketId:r.nextUrl.searchParams.get('ticketId')}:await r.json(),ticketId=String(input.ticketId||'');if(!ticketId||ticketId.length>191)throw Error('Open a saved ticket before voiding it.');
 if(r.method!=='GET')return NextResponse.json(await voidTicket(session.tenantId,session.user,ticketId,input.reason));
 const ticket=await db.ticket.findFirst({where:{id:ticketId,tenantId:session.tenantId},include:{payments:true}});if(!ticket)return NextResponse.json({error:'Ticket not found.'},{status:404});
 const records=await db.tenantSetting.findMany({where:{tenantId:session.tenantId,settingKey:{in:[ticketVoidKey(ticketId),ticketVoidPolicyKey]}}}),policy=records.find(r=>r.settingKey===ticketVoidPolicyKey)?.value as any,voided=records.find(r=>r.settingKey===ticketVoidKey(ticketId))?.value;
 return NextResponse.json({voided: voided||null,allowed:mayVoid(session.user.role,voidRoles(policy?.roles||[])),problem:voidEligibility(ticket)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
export const GET=withRequestPolicy(handle,{feature:'TICKETS'});
export const PATCH=withRequestPolicy(handle,{feature:'TICKETS'});
