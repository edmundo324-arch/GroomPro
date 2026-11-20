import {giftPrepaidVisits,assignPrepaidDog,prepaidRevision} from '@/src/lib/prepaid-transfer';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {requestLocation} from '@/src/lib/request-location';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {prepaidOffersKey} from '@/src/lib/prepaid-offers';
import {prepaidAppliedKey} from '@/src/lib/prepaid-balances';
async function get(r:NextRequest){const session=await platformSession(r);if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});const tenantId=session.tenantId,locationId=await requestLocation(r,tenantId),ticket=await db.ticket.findFirst({where:{tenantId,locationId,id:r.nextUrl.searchParams.get('ticketId')||''},include:{customer:{include:{pets:{where:{active:true}}}}}});if(!ticket||!locationId)return NextResponse.json({error:'Choose a saved ticket at this shop to view prepaid packages.'},{status:404});const rows=await db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:'PREPAID_PURCHASE:'}}}),offers=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:prepaidOffersKey}}}))?.value as any,applied=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:prepaidAppliedKey(ticket.id)}}}))?.value as any;return NextResponse.json({offers:(offers?.offers||[]).filter((o:any)=>o.active),purchases:rows.map(r=>r.value as any).filter(p=>p.customerId===ticket.customerId).map(p=>({...p,revision:prepaidRevision(p)})),applications:applied?.applications||[],pets:ticket.customer.pets.map(p=>({id:p.id,name:p.name}))},{headers:{'Cache-Control':'no-store'}});}
export const GET=withRequestPolicy(get,{feature:'TICKETS'});

export const PATCH=withRequestPolicy(async(r:NextRequest)=>{
 const session=await platformSession(r);if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});
 try{const b=await r.json(),tenantId=session.tenantId,locationId=await requestLocation(r,tenantId);
 const ticket=locationId&&await db.ticket.findFirst({where:{tenantId,locationId,id:String(b.ticketId||'')}});
 if(!ticket)throw Error('Choose a saved ticket at this shop.');
 await db.$transaction(tx=>assignPrepaidDog(tx,tenantId,ticket.customerId,String(b.purchaseId||''),String(b.petId||''),String(b.revision||''),session.user.id));
 return NextResponse.json({assigned:true});}catch(e){return NextResponse.json({error:(e as Error).message},{status:409});}
},{feature:'TICKETS'});

export const POST=withRequestPolicy(async(r:NextRequest)=>{const session=await platformSession(r);if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});try{const b=await r.json(),tenantId=session.tenantId,locationId=await requestLocation(r,tenantId);const ticket=locationId&&await db.ticket.findFirst({where:{tenantId,locationId,id:String(b.ticketId||'')}});if(!ticket)throw Error('Choose a saved ticket at this shop.');const result=await db.$transaction(tx=>giftPrepaidVisits(tx,tenantId,ticket.customerId,{purchaseId:String(b.purchaseId||''),recipientId:String(b.recipientId||''),visits:b.visits,revision:String(b.revision||''),requestId:String(b.requestId||'')},session.user.id));return NextResponse.json(result);}catch(e){return NextResponse.json({error:(e as Error).message},{status:409})}},{feature:'TICKETS'});
