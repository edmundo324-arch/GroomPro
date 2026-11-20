import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {requestLocation} from '@/src/lib/request-location';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {moduleDenial} from '@/src/lib/module-entitlement';
import {sendCustomerEmail} from '@/src/lib/customer-email';
import {writeAudit} from '@/src/lib/audit';
import {giftCardSource} from '@/src/lib/gift-cards';
import {giftCardDocument} from '@/src/lib/gift-card-document';
async function handle(r:NextRequest){
 const session=await platformSession(r),reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});if(!session)return reply({error:'Enter your employee PIN.'},401);
 const tenantId=session.tenantId,locationId=await requestLocation(r,tenantId),ticketId=r.nextUrl.searchParams.get('ticketId')||'',cardId=r.nextUrl.searchParams.get('cardId')||'';
 const ticket=locationId?await db.ticket.findFirst({where:{id:ticketId,tenantId,locationId,lines:{some:{sourceKey:giftCardSource+cardId}}},include:{tenant:{select:{name:true}},customer:{select:{email:true}}}}):null;
 if(!ticket)return reply({error:'This gift card purchase could not be found at the selected shop.'},404);
 const card=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'GIFT_CARD:'+cardId}}}))?.value as any;
 if(!card||card.saleTicketId!==ticket.id||card.state!=='ACTIVE')return reply({error:'Pay and close this gift card purchase before emailing it.'},409);
 const html=giftCardDocument(card,ticket.tenant.name,true),revision=createHash('sha256').update(html+'\n'+(ticket.customer.email||'')).digest('hex');
 if(r.method==='GET')return reply({email:ticket.customer.email||'',revision,last4:card.last4});
 const denial=await moduleDenial(r,'MESSAGING');if(denial)return denial;
 try{const b=await r.json();if(!/^[0-9a-f-]{36}$/i.test(b.requestId||''))return reply({error:'Reopen the gift card email before sending.'},400);if(b.revision!==revision)return reply({error:'The card balance or purchaser email changed. Reopen Email gift card to review the current details.'},409);const email=String(b.email||'').trim();if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({error:'Enter the purchaser’s or recipient’s email address.'},400);
 const id='giftmail_'+createHash('sha256').update(JSON.stringify([tenantId,ticket.id,card.id,b.requestId])).digest('hex').slice(0,40);
 const result=await sendCustomerEmail({tenantId,customerId:ticket.customerId,body:ticket.tenant.name+': your gift card is included in this email. Bring its code when you pay. Anyone with the code can use its remaining balance.',document:{id,ticketId:ticket.id,subject:ticket.tenant.name+' · Gift card ending '+card.last4,html,expectedEmail:email,recipientEmail:email}});
 await writeAudit({tenantId,actorUserId:session.user.id,entityType:'COMMUNICATION',entityId:result.communication.id,customerId:ticket.customerId,action:'GIFT_CARD_EMAIL_'+result.communication.deliveryStatus,summary:result.message,details:{ticketId:ticket.id,cardId:card.id}});return reply({message:result.message,status:result.communication.deliveryStatus});
 }catch{return reply({error:'We could not confirm the gift card email. Check the purchaser’s Communication History before sending another copy.'},400);}
}
export const GET=withRequestPolicy(handle,{feature:'TICKETS'});
export const POST=withRequestPolicy(handle,{feature:'TICKETS'});
