import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {giftCardSource,isGiftCardLine} from './gift-card-line';
export {giftCardSource,isGiftCardLine} from './gift-card-line';
export function giftCardCode(value:unknown){const code=String(value||'').replace(/[ -]/g,'').toUpperCase();if(!/^[A-F0-9]{32}$/.test(code))throw Error('Enter the complete gift card code.');return code;}
const codeKey=(code:string)=>'GIFT_CARD_CODE:'+createHash('sha256').update(code).digest('hex');
const cardKey=(id:string)=>'GIFT_CARD:'+id;
const where=(tenantId:string,settingKey:string)=>({tenantId_settingKey:{tenantId,settingKey}});
function amount(value:number){if(!Number.isSafeInteger(value)||value<=0||value>2147483647)throw Error('Enter a positive gift card amount with no more than two decimal places.');}
async function audit(tx:any,tenantId:string,actorUserId:string,card:any,action:string,details:object){await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId,entityType:'TICKET',entityId:String((details as any).ticketId||card.saleTicketId),action,summary:'Gift card ending '+card.last4+'.',details:{...details,giftCardId:card.id}}});}
async function lockCard(tx:any,tenantId:string,id:string){const key=cardKey(id);await tx.$queryRaw`SELECT id FROM TenantSetting WHERE tenantId=${tenantId} AND settingKey=${key} FOR UPDATE`;const row=await tx.tenantSetting.findUnique({where:where(tenantId,key)});if(!row)throw Error('This gift card could not be found for this business.');return row.value as any;}
export async function prepareGiftCardSale(tx:any,tenantId:string,ticket:any,faceValueCents:number,actorUserId:string){
 amount(faceValueCents);if(!ticket||ticket.tenantId!==tenantId||['CLOSED','CANCELLED','NO_SHOW'].includes(ticket.status))throw Error('Choose an open ticket to sell a gift card.');
 const id=randomUUID(),raw=randomBytes(16).toString('hex').toUpperCase(),code=raw.match(/.{4}/g)!.join('-'),lineId=randomUUID();
 const card={id,code,last4:raw.slice(-4),state:'PENDING',faceValueCents,balanceCents:0,saleTicketId:ticket.id,locationId:ticket.locationId,customerId:ticket.customerId,lineId,createdAt:new Date().toISOString(),activatedAt:null,entries:[]};
 await tx.tenantSetting.create({data:{tenantId,settingKey:cardKey(id),value:card}});await tx.tenantSetting.create({data:{tenantId,settingKey:codeKey(raw),value:{id}}});
 await tx.ticketLine.create({data:{id:lineId,ticketId:ticket.id,lineType:'PRODUCT',role:'PRODUCT',sourceKey:giftCardSource+id,description:'Gift card ending '+card.last4,quantity:1,unitPriceCents:faceValueCents,totalCents:faceValueCents,discountCents:0,sortOrder:9990}});
 await audit(tx,tenantId,actorUserId,card,'GIFT_CARD_PREPARED',{ticketId:ticket.id,faceValueCents});return {id,last4:card.last4,faceValueCents};
}
export async function activateGiftCards(tx:any,tenantId:string,ticket:any,actorUserId:string,at:Date){
 if(ticket.tenantId!==tenantId||ticket.status!=='CLOSED'||(ticket.payments||[]).reduce((n:number,p:any)=>n+Math.round(Number(p.amount)*100),0)!==(ticket.lines||[]).reduce((n:number,l:any)=>n+Math.max(0,l.quantity*l.unitPriceCents-l.discountCents),0)+ticket.tipCents+ticket.salesTaxCents)throw Error('Pay and close the purchase ticket before activating its gift cards.');
 const issued=[];for(const line of ticket.lines.filter(isGiftCardLine)){const id=line.sourceKey.slice(giftCardSource.length),card=await lockCard(tx,tenantId,id);
 if(card.saleTicketId!==ticket.id||card.lineId!==line.id||line.quantity!==1||line.discountCents!==0||line.unitPriceCents!==card.faceValueCents||line.totalCents!==card.faceValueCents)throw Error('A gift card amount changed. Remove that gift card line and add a new card for the intended amount.');
 if(card.state==='PENDING'){card.state='ACTIVE';card.activatedAt=at.toISOString();card.balanceCents=card.faceValueCents;card.entries=[{id:'issue:'+id,kind:'ISSUE',amountCents:card.faceValueCents,ticketId:ticket.id,locationId:ticket.locationId,at:at.toISOString()}];await tx.tenantSetting.update({where:where(tenantId,cardKey(id)),data:{value:card}});await audit(tx,tenantId,actorUserId,card,'GIFT_CARD_ACTIVATED',{ticketId:ticket.id,amountCents:card.faceValueCents});}
 issued.push({id,code:card.code,faceValueCents:card.faceValueCents,balanceCents:card.balanceCents});}return issued;
}
export async function redeemGiftCard(tx:any,input:{tenantId:string;code:unknown;amountCents:number;ticketId:string;locationId:string;paymentId:string;actorUserId:string}){
 const {tenantId,amountCents,paymentId}=input;amount(amountCents);const normalized=giftCardCode(input.code),index=await tx.tenantSetting.findUnique({where:where(tenantId,codeKey(normalized))});if(!index)throw Error('This gift card code was not found for this business. Check the code.');const card=await lockCard(tx,tenantId,index.value.id);
 const prior=card.entries.find((e:any)=>e.id===paymentId);if(prior){if(prior.kind!=='REDEEM'||prior.amountCents!==amountCents||prior.ticketId!==input.ticketId)throw Error('This gift card payment was already recorded with different details.');return {last4:card.last4,balanceCents:card.balanceCents};}
 if(card.state!=='ACTIVE')throw Error('This gift card becomes usable after its purchase ticket is paid and closed.');if(card.balanceCents<amountCents)throw Error('This gift card has $'+(card.balanceCents/100).toFixed(2)+' remaining. Enter that amount or less and use another payment for the rest.');
 card.balanceCents-=amountCents;card.entries.push({id:paymentId,kind:'REDEEM',amountCents,ticketId:input.ticketId,locationId:input.locationId,at:new Date().toISOString()});await tx.tenantSetting.update({where:where(tenantId,cardKey(card.id)),data:{value:card}});await audit(tx,tenantId,input.actorUserId,card,'GIFT_CARD_REDEEMED',{ticketId:input.ticketId,paymentId,amountCents,balanceCents:card.balanceCents});return {last4:card.last4,balanceCents:card.balanceCents};
}

export async function giftCardBalance(tx:any,tenantId:string,code:unknown){const index=await tx.tenantSetting.findUnique({where:where(tenantId,codeKey(giftCardCode(code)))});if(!index)throw Error('This gift card code was not found for this business. Check the code.');const row=await tx.tenantSetting.findUnique({where:where(tenantId,cardKey(index.value.id))}),card=row?.value;if(!card)throw Error('This gift card could not be found.');return {last4:card.last4,state:card.state,balanceCents:card.balanceCents};}
