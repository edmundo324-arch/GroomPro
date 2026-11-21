import {isGiftCardLine} from './gift-card-line';
import {membershipRetention} from './membership-retention';
import {remainingPrepaidValues} from './prepaid-lines';
import {defaultCareStages} from './grooming-experience';
import {bookingStages} from './booking-stages';
// Shared calculations for connected and offline reports. No database or provider access.
export function refundReport(records:any[],start:Date,end:Date){const rows=records.filter(r=>+new Date(r.recordedAt)>=+start&&+new Date(r.recordedAt)<+end).sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt));return {cashCents:rows.filter(r=>r.method==='CASH').reduce((sum,r)=>sum+r.totalCents,0),creditCents:rows.filter(r=>r.method==='CREDIT').reduce((sum,r)=>sum+r.totalCents,0),taxCents:rows.reduce((sum,r)=>sum+r.taxCents,0),tipCents:rows.reduce((sum,r)=>sum+r.tipCents,0),commissionCents:rows.reduce((sum,r)=>sum+r.items.reduce((n:number,i:any)=>n+(i.commissionReversalCents||0),0),0),rows:rows.map(r=>({id:r.id,ticketId:r.ticketId,orderNumber:r.orderNumber,recordedAt:r.recordedAt,method:r.method,totalCents:r.totalCents,taxCents:r.taxCents,tipCents:r.tipCents,reason:r.reason}))};}
export function voidReport(records:any[],start:Date,end:Date){const rows=records.filter(r=>+new Date(r.recordedAt)>=+start&&+new Date(r.recordedAt)<+end).sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt));return {count:rows.length,rows};}
export function reconcileSales(salesCents:number,refunds:any[],lines:any[],voids:any[],start:Date,end:Date){
 const byId=new Map(lines.map(l=>[l.id,l])),seen=new Set<string>();let refundCents=0,giftCardRefundCents=0,balanceRefundCents=0,unclassifiedRefundCents=0;
 for(const refund of refunds){if(seen.has(refund.id)||+new Date(refund.recordedAt)<+start||+new Date(refund.recordedAt)>=+end||!Number.isFinite(+new Date(refund.recordedAt)))continue;seen.add(refund.id);
  for(const item of refund.items||[]){const line=byId.get(item.lineId);if(!line||line.ticketId!==refund.ticketId){unclassifiedRefundCents+=item.amountCents;continue;}if(isGiftCardLine(line))giftCardRefundCents+=item.amountCents;else if(/^Customer Account Balance$/i.test(line.description||''))balanceRefundCents+=item.amountCents;else refundCents+=item.amountCents;}
 }
 const voidRows=new Map(voids.filter(v=>+new Date(v.recordedAt)>=+start&&+new Date(v.recordedAt)<+end).map(v=>[v.ticketId,v]));
 return {salesCents,refundCents,netCents:unclassifiedRefundCents?null:salesCents-refundCents,giftCardRefundCents,balanceRefundCents,unclassifiedRefundCents,voidCents:[...voidRows.values()].reduce((n,v)=>n+v.totalCents,0)};
}
export function accountChanges(customers:any[],entries:any[],start:Date,end:Date){
 const names=new Map(customers.map(c=>[c.id,[c.firstName,c.lastName].filter(Boolean).join(' ')]));
 const seen=new Set<string>();let invalidRecords=0;
 const rows:any[]=[];
 for(const e of entries){if(!names.has(e.customerId)||seen.has(e.id))continue;seen.add(e.id);const at=new Date(e.createdAt);if(!Number.isFinite(+at)||!Number.isSafeInteger(e.amountCents)||!['OWED','CREDIT'].includes(e.entryType)){invalidRecords++;continue;}if(at<start||at>=end)continue;rows.push({id:e.id,customerId:e.customerId,customerName:names.get(e.customerId),createdAt:at.toISOString(),entryType:e.entryType,amountCents:e.amountCents,reason:e.reason||'',ticketId:e.ticketId||null});}
 rows.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
 return {rows,invalidRecords,owedChangeCents:rows.filter(r=>r.entryType==='OWED').reduce((n,r)=>n+r.amountCents,0),creditChangeCents:rows.filter(r=>r.entryType==='CREDIT').reduce((n,r)=>n+r.amountCents,0)};
}
export function membershipActivity(memberships:any[],requests:any[],audits:any[],start:Date,end:Date,asOf:Date){
 const members=new Map(memberships.map(m=>[m.id,m]));const rows:any[]=[],seen=new Set<string>();let invalidRecords=0;
 function add(id:string,membershipId:string,at:any,event:string,source:string){const m=members.get(membershipId);if(!m||seen.has(id))return;seen.add(id);if(!at||!Number.isFinite(+new Date(at))){invalidRecords++;return;}const date=new Date(at);if(date<start||date>=end||date>asOf)return;rows.push({id,membershipId,customerId:m.customerId,customerName:m.customerName||'Name not recorded',membershipName:m.name||'Unnamed membership',occurredAt:date.toISOString(),event,source});}
 for(const m of members.values()){if(m.startedAt)add('start:'+m.id,m.id,m.startedAt,'Membership started','Saved membership start');if(m.endedAt)add('end:'+m.id,m.id,m.endedAt,'Membership ended','Saved membership end');}
 for(const r of requests)if(['CANCEL','PAUSE'].includes(r.requestType))add('request:'+r.id,r.membershipId,r.receivedAt,r.requestType==='CANCEL'?'Cancellation requested':'Pause requested','Recorded membership request');
 for(const a of audits)if(a.action==='MEMBERSHIP_RESUME')add('audit:'+a.id,a.entityId,a.occurredAt,'Membership resumed','Recorded employee action');
 rows.sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)||a.id.localeCompare(b.id));return {rows,invalidRecords,asOf:asOf.toISOString(),retention:membershipRetention(memberships,audits,start,end,asOf)};
}
export function recordedMembershipPayments(payments:any[]){const groups=new Map<string,{name:string;payments:number;amountCents:number;taxCents:number}>();let amountCents=0,taxCents=0,count=0;const seen=new Set<string>();for(const p of payments){if(!p.id||seen.has(p.id)||!['PAID','SUCCEEDED'].includes(p.status)||!p.processedAt||!Number.isFinite(+new Date(p.processedAt))||!Number.isSafeInteger(p.amountCents)||!Number.isSafeInteger(p.taxCents))continue;seen.add(p.id);const name=p.name||'Unnamed membership',row=groups.get(name)||{name,payments:0,amountCents:0,taxCents:0};row.payments++;row.amountCents+=p.amountCents;row.taxCents+=p.taxCents;groups.set(name,row);amountCents+=p.amountCents;taxCents+=p.taxCents;count++;}return {amountCents,taxCents,count,rows:[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name))};}
export function summarizeCareStages(tickets:any[],records:any[]){
 const allowed=new Set(tickets.filter(t=>t.status==='CLOSED').map(t=>t.id));
 const rows=defaultCareStages.map(stage=>({id:stage.id,name:stage.name,started:0,completed:0,incomplete:0,invalid:0,totalSeconds:0,averageSeconds:null as number|null}));
 const seen=new Set<string>();
 for(const record of records){const v=record.value;if(!v||!allowed.has(v.ticketId)||!v.petId||seen.has(v.ticketId+':'+v.petId))continue;seen.add(v.ticketId+':'+v.petId);
  for(const row of rows){const stage=v.stages?.[row.id];if(!stage)continue;const start=Date.parse(stage.startedAt),end=Date.parse(stage.completedAt);if(!Number.isFinite(start)){row.invalid++;continue;}row.started++;if(!stage.completedAt){row.incomplete++;continue;}if(!Number.isFinite(end)||end<start){row.invalid++;continue;}row.completed++;row.totalSeconds+=(end-start)/1000;}
 }
 for(const row of rows)row.averageSeconds=row.completed?row.totalSeconds/row.completed:null;
 return {rows,recordedDogs:seen.size};
}
export function prepaidBalances(purchases:any[],locationId:string,start:Date,end:Date){
 let purchasedCents=0,usedCents=0,usedVisits=0,refundedCents=0,remainingCents=0,remainingVisits=0;
 const rows=[];
 for(const p of purchases){if(p.state!=='ACTIVE')continue;let usedValue=0;
  for(const e of p.entries||[]){if(e.kind==='VISIT')usedValue+=e.amountCents||0;const at=+new Date(e.at);if(e.locationId!==locationId||at<+start||at>=+end||!Number.isFinite(at))continue;
   if(e.kind==='REFUND')refundedCents+=e.amountCents||0;if(e.kind==='PURCHASE')purchasedCents+=e.amountCents||0;if(e.kind==='VISIT'){usedCents+=e.amountCents||0;usedVisits+=e.visits||0;}
  }
  const balance=Array.isArray(p.visitValuesCents)?remainingPrepaidValues(p).reduce((sum,value)=>sum+value,0):Math.max(0,p.offer.priceCents-usedValue);remainingCents+=balance;remainingVisits+=p.visitsRemaining;
  rows.push({id:p.id,name:p.offer.name,customerId:p.customerId,visitsRemaining:p.visitsRemaining,remainingCents:balance,expiresOn:p.expiresOn,awaitingDog:p.offer.scope==='PET'&&!p.petId});
 }
 return {purchasedCents,usedCents,usedVisits,refundedCents,remainingCents,remainingVisits,rows};
}
export function giftCardBalances(cards:any[],locationId:string,start:Date,end:Date,asOf:Date){let issuedCents=0,redeemedCents=0,refundedCents=0,outstandingCents=0;const rows=[];for(const card of cards){if(card.state!=='ACTIVE')continue;let balance=0;for(const entry of card.entries||[]){const at=+new Date(entry.at);if(!Number.isFinite(at)||!Number.isSafeInteger(entry.amountCents)||!['ISSUE','REDEEM','REFUND'].includes(entry.kind))continue;if(at<=+asOf)balance+=(entry.kind==='ISSUE'?1:-1)*entry.amountCents;if(entry.locationId===locationId&&at>=+start&&at<+end){if(entry.kind==='ISSUE')issuedCents+=entry.amountCents;else if(entry.kind==='REDEEM')redeemedCents+=entry.amountCents;else refundedCents+=entry.amountCents;}}if(!card.activatedAt||+new Date(card.activatedAt)>+asOf)continue;outstandingCents+=balance;rows.push({id:card.id,last4:card.last4,activatedAt:card.activatedAt,faceValueCents:card.faceValueCents,balanceCents:balance});}return {issuedCents,redeemedCents,refundedCents,outstandingCents,asOf:asOf.toISOString(),rows};}
export function bookingRecovery(records:any[],tickets:any[],start:Date,end:Date){
 const inPeriod=(date:unknown)=>typeof date==='string'&&Number.isFinite(Date.parse(date))&&Date.parse(date)>=+start&&Date.parse(date)<+end;
 const attempts=records.map(r=>r.value).filter(v=>v&&inPeriod(v.startedAt));const submitted=attempts.filter(v=>v.state==='COMPLETED').length;const stages=Object.entries(bookingStages).map(([id,name])=>({id,name,count:attempts.filter(v=>v.state!=='COMPLETED'&&(v.stage||'STARTED')===id).length}));const funnel={started:attempts.length,submitted,unfinished:attempts.length-submitted,submissionRate:attempts.length?submitted/attempts.length*100:null,stages};
 const rows:any[]=[];const seen=new Set<string>();let resumedBookings=0,closedSalesCents=0,closedTickets=0;
 for(const r of records){const v=r.value;if(v?.state!=='COMPLETED'||!v.resumedAfterInactivityAt||!v.ticketId||seen.has(v.ticketId))continue;
 const t=tickets.find(t=>t.id===v.ticketId&&t.customerId===v.customerId&&t.locationId===v.locationId);if(!t)continue;seen.add(t.id);
 const booked=inPeriod(v.completedAt),closed=t.status==='CLOSED'&&inPeriod(t.closedAt instanceof Date?t.closedAt.toISOString():t.closedAt);if(!booked&&!closed)continue;
 const sales=closed?(t.lines||[]).filter((l:any)=>!isGiftCardLine(l)&&!/^Customer Account Balance$/i.test(l.description||'')).reduce((n:number,l:any)=>n+l.totalCents,0):0;
 if(booked)resumedBookings++;if(closed){closedTickets++;closedSalesCents+=sales;}
 rows.push({ticketId:t.id,orderNumber:t.orderNumber,status:t.status,bookedAt:v.completedAt,closedAt:t.closedAt,bookedInPeriod:booked,closedInPeriod:closed,salesCents:sales});
 }
 return {resumedBookings,closedTickets,closedSalesCents,rows,funnel};
}
export function inventorySnapshot(products:{id:string;name:string;sku:string|null;active:boolean;quantity:number;costCents:number;priceCents:number}[],asOf=new Date()){
 const rows=products.map(p=>({...p,recordedCostValueCents:p.quantity*p.costCents,retailValueCents:p.quantity*p.priceCents}));
 return {asOf:asOf.toISOString(),products:rows.length,units:rows.reduce((n,p)=>n+p.quantity,0),recordedCostValueCents:rows.reduce((n,p)=>n+p.recordedCostValueCents,0),retailValueCents:rows.reduce((n,p)=>n+p.retailValueCents,0),zeroCostProducts:rows.filter(p=>p.quantity>0&&p.costCents===0).length,rows};
}
export function soldProductCosts(closed:any[],audits:any[]){
 const snapshots=new Map<string,any[]>();for(const a of audits){const d=a.details||{},key=JSON.stringify([d.ticketId,a.entityId]);snapshots.set(key,[...(snapshots.get(key)||[]),d]);}
 const products=new Map<string,any>();let salesCents=0,knownCostCents=0,salesWithKnownCostCents=0,unitsWithoutCost=0;
 for(const t of closed){const groups=new Map<string,any>();for(const l of t.lines||[]){if(l.lineType!=='PRODUCT'||isGiftCardLine(l))continue;const id=l.productId||'line:'+l.id;const g=groups.get(id)||{id,productId:l.productId,name:l.description,units:0,salesCents:0};g.units+=l.quantity;g.salesCents+=l.totalCents;groups.set(id,g);}
  for(const g of groups.values()){const costs=snapshots.get(JSON.stringify([t.id,g.productId]))||[],cost=costs.length===1?costs[0]:null;const known=cost&&Number.isSafeInteger(cost.unitCostCents)&&cost.unitCostCents>=0&&cost.sold===g.units&&g.units>0;const row=products.get(g.id)||{id:g.id,name:g.name,units:0,salesCents:0,knownCostCents:0,salesWithKnownCostCents:0,unitsWithoutCost:0};row.units+=g.units;row.salesCents+=g.salesCents;salesCents+=g.salesCents;if(known){const amount=cost.unitCostCents*g.units;row.knownCostCents+=amount;row.salesWithKnownCostCents+=g.salesCents;knownCostCents+=amount;salesWithKnownCostCents+=g.salesCents;}else{row.unitsWithoutCost+=g.units;unitsWithoutCost+=g.units;}products.set(g.id,row);}
 }
 return {salesCents,knownCostCents,salesWithKnownCostCents,unitsWithoutCost,recordedMarginCents:salesWithKnownCostCents-knownCostCents,rows:[...products.values()]};
}
export function customerSales(tickets:any[],asOf:Date){
 const customers=new Map<string,any>();let excludedBalanceCents=0;
 for(const t of tickets){if(t.status!=='CLOSED'||!t.closedAt||!Number.isFinite(new Date(t.closedAt).getTime())||new Date(t.closedAt)>asOf)continue;const lines=(t.lines||[]).filter((l:any)=>{if(isGiftCardLine(l))return false;if(/^Customer Account Balance$/i.test(l.description||'')){excludedBalanceCents+=l.totalCents;return false;}return true;});if(!lines.length)continue;
 const row=customers.get(t.customerId)||{id:t.customerId,name:[t.customer?.firstName,t.customer?.lastName].filter(Boolean).join(' ')||'Customer',active:t.customer?.active!==false,salesCents:0,tickets:0,firstVisit:t.closedAt,lastVisit:t.closedAt};row.salesCents+=lines.reduce((n:number,l:any)=>n+l.totalCents,0);row.tickets++;if(new Date(t.closedAt)<new Date(row.firstVisit))row.firstVisit=t.closedAt;if(new Date(t.closedAt)>new Date(row.lastVisit))row.lastVisit=t.closedAt;customers.set(t.customerId,row);}
 const rows=[...customers.values()].map(r=>({...r,averageCents:Math.round(r.salesCents/r.tickets)})).sort((a,b)=>b.salesCents-a.salesCents||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
 return {asOf:asOf.toISOString(),salesCents:rows.reduce((n,r)=>n+r.salesCents,0),customers:rows.length,excludedBalanceCents,rows};
}
export function customRuleResults(audits:any[],references:any[],messages:any[],tasks:any[],names:Map<string,string>,bookings:any[]=[]){
 const rows=new Map<string,any>(),byMessage=new Map(messages.map(m=>[m.id,m])),byTask=new Map(tasks.map(t=>[t.id,t]));
 const row=(id:string)=>{if(!rows.has(id))rows.set(id,{id,name:names.get(id)||'Rule no longer available',tasks:0,completedTasks:0,notices:0,messages:0,delivered:0,failed:0,unconfirmed:0,notSubmitted:0,bookedCustomers:0});return rows.get(id);};
 const seen=new Set<string>();for(const a of audits){if(!a.details?.ruleId||seen.has(a.id))continue;seen.add(a.id);const r=row(a.details.ruleId);if(a.action==='CUSTOM_RULE_TASK'){r.tasks++;if(byTask.get(a.details.recordId)?.completedAt)r.completedTasks++;}else if(a.action==='CUSTOM_RULE_NOTICE')r.notices++;}
 const refs=new Set<string>();for(const v of references){if(!v.ruleId||refs.has(v.communicationId))continue;refs.add(v.communicationId);const r=row(v.ruleId),m=byMessage.get(v.communicationId);r.messages++;if(!m)r.notSubmitted++;else if(m.deliveryStatus==='DELIVERED')r.delivered++;else if(['FAILED','UNDELIVERED','BOUNCED','SUPPRESSED','NOT_CONFIGURED'].includes(m.deliveryStatus))r.failed++;else r.unconfirmed++;}
 const booked=new Map<string,Set<string>>();for(const v of references){const m=byMessage.get(v.communicationId);if(!m||!['SENT','DELIVERED','ACCEPTED'].includes(m.deliveryStatus))continue;const sentAt=+new Date(m.createdAt||v.recordedAt);if(!Number.isFinite(sentAt))continue;if(bookings.some(t=>t.customerId===v.customerId&&!!t.scheduledStart&&+new Date(t.createdAt)>sentAt&&['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY','CLOSED'].includes(t.status)&&!['REQUESTED','PENDING','REJECTED'].includes(t.bookingDecision))){if(!booked.has(v.ruleId))booked.set(v.ruleId,new Set());booked.get(v.ruleId)!.add(v.customerId);}}for(const [id,customers] of booked)row(id).bookedCustomers=customers.size;
 return {rows:[...rows.values()].sort((a,b)=>a.name.localeCompare(b.name))};
}
export function productivityRows(employees:any[],tickets:any[],availability:any[],start:Date,end:Date,past:boolean){
 const rows=new Map(employees.map(e=>[e.id,{id:e.id,name:e.displayName||[e.firstName,e.lastName].filter(Boolean).join(' '),itemMinutes:0,availableMinutes:availability.find(a=>a.userId===e.id)?.minutes||0,invalidShifts:availability.find(a=>a.userId===e.id)?.invalidShifts||0,unassignedShopShifts:availability.find(a=>a.userId===e.id)?.unassignedShopShifts||0,items:0}]));let invalidItems=0,unassignedMinutes=0;const seen=new Set<string>();
 for(const t of tickets){const date=new Date(t.scheduledStart);if(!t.scheduledStart||!Number.isFinite(+date)||date<start||date>=end||['REQUESTED','PENDING'].includes(t.bookingDecision)||!(past?['CLOSED']:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY','CLOSED']).includes(t.status))continue;
  for(const line of t.lines||[]){if(line.lineType!=='SERVICE')continue;const key=t.id+':'+line.id;if(seen.has(key))continue;seen.add(key);if(!Number.isSafeInteger(line.durationMin)||line.durationMin<0||!Number.isSafeInteger(line.quantity)||line.quantity<1){invalidItems++;continue;}const minutes=line.durationMin*line.quantity;if(!Number.isSafeInteger(minutes)){invalidItems++;continue;}if(!line.assignedUserId){unassignedMinutes+=minutes;continue;}const row=rows.get(line.assignedUserId);if(row){row.itemMinutes+=minutes;row.items++;}}
 }
 return {start:start.toISOString(),end:end.toISOString(),invalidItems,unassignedMinutes,rows:[...rows.values()].filter(r=>r.itemMinutes||r.availableMinutes||r.invalidShifts||r.unassignedShopShifts).map(r=>({...r,percent:r.availableMinutes>0?r.itemMinutes/r.availableMinutes*100:null}))};
}
export function messageDeliveryCounts(messages:any[]){
 const rows=new Map<string,any>();
 for(const m of messages){const key=JSON.stringify([m.subject||'Appointment message',m.channel,m.deliveryStatus||'RECORDED']);const row=rows.get(key)||{name:m.subject||'Appointment message',channel:m.channel,status:m.deliveryStatus||'RECORDED',count:0};row.count++;rows.set(key,row);}
 return {total:messages.length,rows:[...rows.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.channel.localeCompare(b.channel)||a.status.localeCompare(b.status))};
}
