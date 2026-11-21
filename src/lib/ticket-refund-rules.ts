import {ticketSettledCents} from './ticket-settlement';
import {dogTicketTotals} from './dog-ticket-summary';
import {isGiftCardLine} from './gift-card-line';
import {isPrepaidPurchaseLine} from './prepaid-lines';

export type RefundItem={lineId:string;amountCents:number;returnQuantity:number;refundVisits?:number;purchaseId?:string};
export type RefundRequest={id:string;method:'CASH'|'CREDIT';reason:string;items:RefundItem[];taxCents:number;tipCents:number;recipientCustomerId?:string};
const cents=(value:any)=>Number.isSafeInteger(value)&&value>=0&&value<=2147483647;
export function refundRequest(value:any):RefundRequest{
 if(!value||typeof value.id!=='string'||!/^[a-z0-9-]{16,64}$/i.test(value.id)||!['CASH','CREDIT'].includes(value.method))throw Error('Choose cash or customer-account credit and reopen the refund if needed.');
 if(typeof value.reason!=='string'||!value.reason.trim()||value.reason.trim().length>1000)throw Error('Enter a refund reason of up to 1,000 characters.');
 if(!Array.isArray(value.items)||value.items.length>200||!cents(value.taxCents)||!cents(value.tipCents))throw Error('Review the refund items, tax and tip amounts.');
 const seen=new Set<string>();const items=value.items.map((item:any)=>{
  if(!item||typeof item.lineId!=='string'||!item.lineId||item.lineId.length>191||seen.has(item.lineId)||!cents(item.amountCents)||item.amountCents===0||!Number.isSafeInteger(item.returnQuantity)||item.returnQuantity<0)throw Error('Choose each refunded item once, with a positive amount and a valid stock-return quantity.');
  if(item.refundVisits!==undefined&&(!Number.isSafeInteger(item.refundVisits)||item.refundVisits<1))throw Error('Choose a whole number of unused prepaid visits.');
  seen.add(item.lineId);return {lineId:item.lineId,amountCents:item.amountCents,returnQuantity:item.returnQuantity,...(item.refundVisits===undefined?{}:{refundVisits:item.refundVisits}),...(item.purchaseId===undefined?{}:{purchaseId:String(item.purchaseId)})};
 });
 const total=items.reduce((sum:number,item:RefundItem)=>sum+item.amountCents,0)+value.taxCents+value.tipCents;
 if(!cents(total)||total<=0)throw Error('Enter a refund greater than $0.');
 return {id:value.id,method:value.method,reason:value.reason.trim(),items,taxCents:value.taxCents,tipCents:value.tipCents,...(value.recipientCustomerId===undefined?{}:{recipientCustomerId:String(value.recipientCustomerId)})};
}
export function ordinaryRefundLine(line:any){return ['SERVICE','PRODUCT'].includes(line.lineType)&&((!isGiftCardLine(line)&&!isPrepaidPurchaseLine(line))||line.storedRefund?.allowed===true)&&!/^Customer Account Balance$/i.test(line.description||'');}
export function refundAvailable(ticket:any,refunds:any[]){
 const taxes=dogTicketTotals(ticket.lines.filter((l:any)=>!/^Customer Account Balance$/i.test(l.description||'')).map((l:any)=>({...l,petId:l.id})),ticket.salesTaxCents);
 const totalRefunded=refunds.reduce((sum,r)=>sum+r.totalCents,0),paid=ticketSettledCents(ticket);
 return {remainingCents:Math.max(0,Math.min(ticket.totalCents,paid)-totalRefunded),taxCents:Math.max(0,ticket.salesTaxCents-refunds.reduce((sum,r)=>sum+r.taxCents,0)),tipCents:Math.max(0,ticket.tipCents-refunds.reduce((sum,r)=>sum+r.tipCents,0)),lines:ticket.lines.filter(ordinaryRefundLine).map((line:any)=>{const prior=refunds.flatMap(r=>r.items).filter((r:RefundItem)=>r.lineId===line.id);return {...line,refundCapCents:Math.max(0,line.totalCents-prior.reduce((sum:number,r:RefundItem)=>sum+r.amountCents,0)),taxShareCents:(taxes[line.id]?.totalCents||0)-(taxes[line.id]?.subtotalCents||0),remainingCents:Math.min(line.storedRefund?.balanceCents??Infinity,Math.max(0,line.totalCents-prior.reduce((sum:number,r:RefundItem)=>sum+r.amountCents,0))),returnableQuantity:line.lineType==='PRODUCT'&&line.productId?Math.max(0,line.quantity-prior.reduce((sum:number,r:RefundItem)=>sum+r.returnQuantity,0)):0};})};
}
export function validateRefund(ticket:any,refunds:any[],input:RefundRequest){
 if(ticket.status!=='CLOSED')throw Error('Refunds are recorded against closed tickets. Review this ticket before continuing.');
 const available=refundAvailable(ticket,refunds),totalCents=input.items.reduce((sum,item)=>sum+item.amountCents,0)+input.taxCents+input.tipCents;
 if(totalCents>available.remainingCents||input.taxCents>available.taxCents||input.tipCents>available.tipCents)throw Error('This refund exceeds the remaining paid amount, tax or tip. Refresh the refund to review earlier refunds.');
 for(const item of input.items){const line=available.lines.find((l:any)=>l.id===item.lineId);if(!line||item.amountCents>line.remainingCents||item.returnQuantity>line.returnableQuantity)throw Error('A selected item has changed or exceeds its remaining refundable amount or stock-return quantity. Reopen the refund to review it.');if(line.storedRefund?.kind==='PREPAID'){const values=line.storedRefund.visitValuesCents;if(!item.refundVisits||item.refundVisits>values.length||values.slice(0,item.refundVisits).reduce((n:number,v:number)=>n+v,0)!==item.amountCents)throw Error('Refund whole unused visits at their saved share of the purchase price.');}else if(item.refundVisits!==undefined)throw Error('Only prepaid package refunds can remove visits.');}
 if(input.recipientCustomerId&&input.recipientCustomerId!==ticket.customerId&&(input.tipCents||!input.items.length||input.items.some(i=>{const line=available.lines.find((l:any)=>l.id===i.lineId);return line?.storedRefund?.kind!=='PREPAID'||line.storedRefund.customerId!==input.recipientCustomerId;})))throw Error('To refund a gift recipient, choose only that family’s unused prepaid visits. Refund other items to the original purchaser separately.');
 return {totalCents,available};
}

export function proportionalTipReversal(amount:number,remaining:number,shares:{userId:string;amountCents:number}[]){
 if(!cents(amount)||!cents(remaining)||amount>remaining||shares.some(s=>!s.userId||!cents(s.amountCents))||new Set(shares.map(s=>s.userId)).size!==shares.length)throw Error('The saved tip allocation needs review before this refund.');
 const assigned=shares.reduce((sum,s)=>sum+s.amountCents,0);if(assigned>remaining)throw Error('Assigned tips exceed the remaining tip. Review the tip allocation before refunding.');
 if(!amount)return [];
 const rows=[...shares,{userId:'',amountCents:remaining-assigned}].map(s=>({...s,reversed:Math.floor(amount*s.amountCents/remaining),remainder:(amount*s.amountCents)%remaining}));let left=amount-rows.reduce((sum,r)=>sum+r.reversed,0);
 for(const row of [...rows].sort((a,b)=>b.remainder-a.remainder||a.userId.localeCompare(b.userId))){if(left--<=0)break;row.reversed++;}
 return rows.filter(r=>r.userId&&r.reversed).map(r=>({userId:r.userId,amountCents:r.reversed}));
}
