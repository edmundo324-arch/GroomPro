import type {ReportHistory} from './offline-report-history';
import {accountChanges,bookingRecovery,customRuleResults,customerSales,giftCardBalances,inventorySnapshot,membershipActivity,messageDeliveryCounts,prepaidBalances,productivityRows,reconcileSales,recordedMembershipPayments,refundReport,soldProductCosts,summarizeCareStages,voidReport} from './report-calculations';
import {reportSummary} from './report-summary';
import {salesBreakdowns} from './report-sales-breakdowns';
import {reportReconciliation} from './report-reconciliation';
import {paymentRecords} from './report-payment-records';
import {closedTicketTax} from './report-sales-tax';
import {membershipEnrollment} from './report-membership-enrollment';
import {cancellationReport} from './report-cancellations';
import {appointmentBreakdowns} from './report-appointments';
import {employeeReport} from './employee-report';
import {currentReceivables} from './report-receivables';
import {customerRetention,retentionWeeks} from './report-retention';
import {returnVisitCohorts} from './report-return-visits';
import {productivityPeriods,productivityScheduledMinutes} from './productivity-periods';
import {localToInstant} from './operating-hours';
import {parseDate} from './schedule-dates';
export function offlineReport(history:ReportHistory,params:URLSearchParams,pendingAppointments:any[]=[]){
 if(history.version!==1)throw Error('Reconnect to prepare reporting history for this device.');
 if(params.get('locations')==='compare')throw Error('Connect to compare locations. Each shop’s offline history remains separate.');
 if(params.has('locations'))return {locations:[history.location],selected:history.location.id};
 if(params.get('locationId')&&params.get('locationId')!==history.location.id)throw Error('This device’s reporting history belongs to a different shop.');
 const {parts:p,location}=history,asOf=new Date(history.asOf),zone=location.timezone,from=params.get('from'),through=params.get('through');let start:Date,end:Date;
 if(from&&through){parseDate(from);parseDate(through);start=localToInstant(from+'T00:00',zone);const next=new Date(through+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);end=localToInstant(next.toISOString().slice(0,10)+'T00:00',zone);}else{start=new Date(params.get('start')||Date.now());end=new Date(params.get('end')||Date.now()+14*86400000);}
 if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start)throw Error('Choose an ending date on or after the beginning date.');
 const inPeriod=(date:any,a:Date,b:Date)=>!!date&&+new Date(date)>=+a&&+new Date(date)<+b;
 const settings=(prefix:string)=>p.settings.filter(r=>r.settingKey.startsWith(prefix));
 const values=(prefix:string)=>settings(prefix).map(r=>r.value);
 const customers=new Map(p.customers.map(c=>[c.id,c])),names=new Map(p.customers.map(c=>[c.id,[c.firstName,c.lastName].filter(Boolean).join(' ')]));
 const tickets=p.tickets,ids=new Set(tickets.map(t=>t.id));
 const appointmentMap=new Map(tickets.map(t=>[t.id,t])),pendingIds=new Set<string>();
 for(const ticket of pendingAppointments){const previous=appointmentMap.get(ticket.id);if(ticket.locationId!==location.id||previous&&['CLOSED','CANCELLED','NO_SHOW','VOID'].includes(previous.status))continue;
  if(JSON.stringify(previous)===JSON.stringify(ticket))continue;appointmentMap.set(ticket.id,ticket);pendingIds.add(ticket.id);
 }
 const appointmentTickets=[...appointmentMap.values()];
 const refunds=values('TICKET_REFUND:').filter(v=>ids.has(v.ticketId)),voids=values('TICKET_VOID:').filter(v=>ids.has(v.ticketId)),voidIds=new Set(voids.map(v=>v.ticketId));
 const clocks=new Map<string,any>(settings('TIME_CLOCK:').map(r=>[r.settingKey.slice(11),r.value]));
 const allocations=new Map(settings('TICKET_TIPS:').map(r=>[r.settingKey.slice(12),r.value]));
 const referrals=new Map(settings('CUSTOMER_REFERRAL:').map(r=>[r.settingKey.slice(18),r.value?.referralSource||'Not recorded']));
 const members=p.memberships.filter(m=>customers.has(m.customerId)).map(m=>({...m,customerName:names.get(m.customerId)}));
 function period(a:Date,b:Date){
  const visits=tickets.filter(t=>inPeriod(t.scheduledStart,a,b)&&!voidIds.has(t.id)),closed=tickets.filter(t=>t.status==='CLOSED'&&inPeriod(t.closedAt,a,b)),payments=p.payments.filter(v=>inPeriod(v.paidAt,a,b));
  const appointmentVisits=appointmentTickets.filter(t=>inPeriod(t.scheduledStart,a,b)&&!voidIds.has(t.id));
  const breakdowns=salesBreakdowns(closed,p.employees,zone),periods=productivityPeriods(a,b,asOf,zone);let past=null,planned=null;
  if(periods.past){const range=periods.past,work=employeeReport(p.employees,[],clocks,location.id,range.start,range.end,asOf);past={...productivityRows(p.employees,tickets,work.rows.map(r=>({userId:r.id,minutes:r.minutesExcludingBreaks})),range.start,range.end,true),invalidTimeRecords:work.invalidRecords};}
  if(periods.planned){const range=periods.planned,availability=productivityScheduledMinutes(p.employees,p.shifts,p.overrides,location.id,range.start,range.end,zone);planned=productivityRows(p.employees,appointmentTickets,availability,range.start,range.end,false);}
  const deposits=values('CUSTOMER_DEPOSIT:').filter(v=>v.locationId===location.id&&customers.has(v.customerId)&&Number.isSafeInteger(v.amountCents)&&v.amountCents>0&&inPeriod(v.recordedAt,a,b)).map(v=>({...v,customerName:names.get(v.customerId)})).sort((x,y)=>x.recordedAt.localeCompare(y.recordedAt));
  const refs=values('CUSTOM_RULE_DELIVERY:').filter(v=>customers.has(v.customerId)&&inPeriod(v.recordedAt,a,b)),ruleNames=new Map<string,string>(values('CUSTOM_RULE:').map(v=>[v.id,v.name]));
  return {...reportSummary(appointmentVisits.filter(t=>t.status!=='CANCELLED'),payments,closed,members,p.customers.filter(c=>inPeriod(c.createdAt,a,b)).map(c=>({source:referrals.get(c.id)||'Not recorded'})),a,b),
   customRules:{...customRuleResults(p.audits.filter(r=>inPeriod(r.occurredAt,a,b)&&['CUSTOM_RULE_TASK','CUSTOM_RULE_NOTICE'].includes(r.action)),refs,p.messages,values('STAFF_TASK:'),ruleNames,p.visits),staffScope:history.canManageTime?'TEAM':'SELF'},
   deposits:{rows:deposits,collectedCents:deposits.reduce((sum,r)=>sum+r.amountCents,0)},voids:voidReport(voids,a,b),productivity:{asOf:asOf.toISOString(),past,planned},membershipActivity:membershipActivity(members,p.membershipRequests,p.audits,a,b,asOf),accountChanges:accountChanges(p.customers,p.accountEntries,a,b),refunds:refundReport(refunds,a,b),membershipEnrollment:membershipEnrollment(members,a,b,asOf,zone),salesTax:closedTicketTax(closed),paymentRecords:paymentRecords(payments),membershipPayments:recordedMembershipPayments(p.membershipPayments.filter(v=>inPeriod(v.processedAt,a,b))),careStages:summarizeCareStages(closed,settings('GROOMING_PROGRESS:')),prepaid:prepaidBalances(values('PREPAID_PURCHASE:'),location.id,a,b),giftCards:giftCardBalances(values('GIFT_CARD:'),location.id,a,b,asOf),bookingRecovery:bookingRecovery(settings('PORTAL_UNFINISHED:'),tickets,a,b),productCosts:soldProductCosts(closed,p.audits.filter(r=>r.action==='TICKET_STOCK_SALE')),messageDelivery:messageDeliveryCounts(p.messages.filter(r=>r.id.startsWith('appt_')&&ids.has(r.ticketId)&&inPeriod(r.createdAt,a,b))),cancellations:cancellationReport(visits,settings('PORTAL_CANCELLATION:'),p.audits.filter(r=>r.action==='CANCELLATION_REVIEW')),appointmentVolume:appointmentBreakdowns(appointmentVisits,p.employees,zone),reconciliation:reportReconciliation(payments,closed,p.accountEntries),salesBreakdowns:{...breakdowns,reconciliation:reconcileSales(breakdowns.netLineSalesCents,refunds,tickets.flatMap(t=>t.lines),voids,a,b)},employeeWork:{...employeeReport(p.employees,closed,clocks,location.id,a,b,asOf,allocations,refunds),scope:history.canManageTime?'TEAM':'SELF'}};
 }
 const configured=p.settings.find(r=>r.settingKey==='CUSTOMER_RETENTION_WEEKS'),weeks=configured?retentionWeeks(configured.value):6;
 const retention={...customerRetention(p.customers.filter(c=>c.active!==false),p.visits,p.visits,weeks,asOf,start,end,zone),returnVisits:returnVisitCohorts(p.customers,p.visits,weeks,asOf,start,end,zone)};
 let previous;if(params.get('compare')==='true'){let prior=new Date(+start-(+end-+start));if(from&&through){const days=Math.round((Date.parse(through+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000)+1;prior=localToInstant(new Date(Date.parse(from+'T12:00:00Z')-days*86400000).toISOString().slice(0,10)+'T00:00',zone);}previous=period(prior,start);}
 return {...period(start,end),retention,receivables:currentReceivables(p.customers.filter(c=>c.balanceCents>0||c.creditCents>0),tickets.filter(t=>['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY'].includes(t.status)),asOf),lifetimeSales:customerSales(tickets,asOf),inventory:inventorySnapshot(p.products,asOf),start,end,locationId:location.id,timezone:zone,previous,offlineReport:true,offlinePendingAppointments:pendingIds.size,offlineSavedAt:history.asOf};
}

export function offlineShopComparison(histories:ReportHistory[],from:string,through:string,pendingByShop:Record<string,any[]>={}){
 parseDate(from);parseDate(through);if(through<from)throw Error('Choose an ending date on or after the beginning date.');
 if(!histories.length||histories.some(h=>!h.canManageTime||h.scope.tenantId!==histories[0].scope.tenantId||h.scope.employeeId!==histories[0].scope.employeeId))throw Error('Reconnect as an owner or manager to prepare shop comparisons.');
 const next=new Date(through+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);
 let pendingCount=0;
 const rows=histories.map(h=>{const appointments=new Map(h.parts.tickets.map(t=>[t.id,t]));for(const ticket of pendingByShop[h.location.id]||[]){const original=appointments.get(ticket.id);if(ticket.locationId!==h.location.id||original&&['CLOSED','CANCELLED','NO_SHOW','VOID'].includes(original.status))continue;appointments.set(ticket.id,ticket);pendingCount++;}const start=localToInstant(from+'T00:00',h.location.timezone),end=localToInstant(next.toISOString().slice(0,10)+'T00:00',h.location.timezone),inside=(v:any)=>v&&+new Date(v)>=+start&&+new Date(v)<+end,closed=h.parts.tickets.filter(t=>t.status==='CLOSED'&&inside(t.closedAt));return {...h.location,appointments:[...appointments.values()].filter(t=>t.status!=='CANCELLED'&&inside(t.scheduledStart)).length,closedTickets:closed.length,salesCents:salesBreakdowns(closed,[],h.location.timezone).netLineSalesCents,paymentsCents:h.parts.payments.filter(p=>inside(p.paidAt)).reduce((sum,p)=>sum+Math.round(Number(p.amount)*100),0)};});
 const totals=rows.reduce((sum,r)=>({appointments:sum.appointments+r.appointments,closedTickets:sum.closedTickets+r.closedTickets,salesCents:sum.salesCents+r.salesCents,paymentsCents:sum.paymentsCents+r.paymentsCents}),{appointments:0,closedTickets:0,salesCents:0,paymentsCents:0});
 return {from,through,asOf:histories.map(h=>h.asOf).sort()[0],rows,totals,offlineReport:true,offlinePendingAppointments:pendingCount};
}
