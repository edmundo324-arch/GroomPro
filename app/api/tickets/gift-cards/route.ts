import {giftCardDocument} from '@/src/lib/gift-card-document';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {requestLocation} from '@/src/lib/request-location';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {giftCardBalance,giftCardSource,isGiftCardLine} from '@/src/lib/gift-cards';
async function get(r:NextRequest){const session=await platformSession(r);if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});const tenantId=session.tenantId,locationId=await requestLocation(r,tenantId),ticket=await db.ticket.findFirst({where:{tenantId,locationId,id:r.nextUrl.searchParams.get('ticketId')||''},include:{lines:true}});if(!ticket)return NextResponse.json({error:'Ticket not found.'},{status:404});const keys=ticket.lines.filter(isGiftCardLine).map(l=>'GIFT_CARD:'+l.sourceKey!.slice(giftCardSource.length)),rows=keys.length?await db.tenantSetting.findMany({where:{tenantId,settingKey:{in:keys}}}):[];const cardId=r.nextUrl.searchParams.get('cardId');if(cardId){const card=rows.find(row=>(row.value as any).id===cardId)?.value as any;if(!card||card.state!=='ACTIVE')return NextResponse.json({error:'Pay and close this gift card purchase before printing it.'},{status:409});const tenant=await db.tenant.findUniqueOrThrow({where:{id:tenantId},select:{name:true}});return NextResponse.json({html:giftCardDocument(card,tenant.name)},{headers:{'Cache-Control':'no-store'}});}return NextResponse.json({cards:rows.map(row=>{const c=row.value as any;return {id:c.id,last4:c.last4,state:c.state,faceValueCents:c.faceValueCents,balanceCents:c.balanceCents,code:c.state==='ACTIVE'?c.code:undefined}})},{headers:{'Cache-Control':'no-store'}});}
export const GET=withRequestPolicy(get,{feature:'TICKETS'});

async function post(r:NextRequest){const session=await platformSession(r);if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});try{const b=await r.json();return NextResponse.json(await giftCardBalance(db,session.tenantId,b.code),{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
export const POST=withRequestPolicy(post,{feature:'TICKETS'});
