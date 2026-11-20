import {refundReportRecords,refundReport} from '@/src/lib/report-refunds';
import {membershipEnrollment} from '@/src/lib/report-membership-enrollment';
import {closedTicketTax} from '@/src/lib/report-sales-tax';
import {paymentRecords} from '@/src/lib/report-payment-records';
import {membershipPaymentsReport} from '@/src/lib/report-membership-payments';
import {careStageReport} from '@/src/lib/report-care-stages';
import {prepaidReport} from '@/src/lib/report-prepaid';
import {giftCardReport} from '@/src/lib/report-gift-cards';
import {bookingRecoveryReport} from '@/src/lib/report-booking-recovery';
import {currentInventoryReport,productCostReport} from '@/src/lib/report-inventory';
import {appointmentDeliveryReport} from '@/src/lib/report-message-delivery';
import {customerLifetimeSales} from '@/src/lib/report-customer-sales';
import {retentionReport} from '@/src/lib/report-customer-outcomes';
import {cancellationReport} from '@/src/lib/report-cancellations';
import {appointmentBreakdowns} from '@/src/lib/report-appointments';
import {currentReceivables} from '@/src/lib/report-receivables';
import {salesBreakdowns} from '@/src/lib/report-sales-breakdowns';
import {employeeReport} from '@/src/lib/employee-report';
import type {ClockState} from '@/src/lib/time-clock';
import {Prisma} from '@prisma/client';
import {reportReconciliation} from '@/src/lib/report-reconciliation';
import {db} from '@/src/lib/db';
import {localToInstant} from '@/src/lib/operating-hours';
import {reportSummary} from '@/src/lib/report-summary';
export async function reportData({tenantId,location,start,end,userId,canManageTime,hideOwners,compare=false,from,through}:{tenantId:string;location:{id:string;timezone:string};start:Date;end:Date;userId:string;canManageTime:boolean;hideOwners:boolean;compare?:boolean;from?:string|null;through?:string|null}){
 const locationId=location.id;
 const reportTimezone=location.timezone;
 const employees=await db.user.findMany({where:{tenantId,...(!canManageTime?{id:userId}:hideOwners?{role:{not:'PLATFORM_OWNER' as const}}:{})},select:{id:true,firstName:true,lastName:true,displayName:true},orderBy:{lastName:'asc'}});
 const clockRecords=await db.tenantSetting.findMany({where:{tenantId,settingKey:{in:employees.map(e=>'TIME_CLOCK:'+e.id)}}});
 const clocks=new Map(clockRecords.map(row=>[row.settingKey.slice('TIME_CLOCK:'.length),row.value as unknown as ClockState]));
 const asOf=new Date(),refundRecords=await refundReportRecords(tenantId,locationId);
 async function period(a:Date,b:Date){
 const [tickets,payments,closed,memberships,customers,referrals]=await Promise.all([
 db.ticket.findMany({where:{tenantId,locationId,scheduledStart:{gte:a,lt:b}},include:{lines:{include:{service:{select:{name:true}}}}}}),
 db.payment.findMany({where:{tenantId,paidAt:{gte:a,lt:b},ticket:{tenantId,locationId}},include:{ticket:{select:{orderNumber:true}}}}),
 db.ticket.findMany({where:{tenantId,locationId,status:'CLOSED',closedAt:{gte:a,lt:b}},include:{pets:{select:{petId:true}},lines:{include:{service:{select:{name:true}},assignedUser:true}}}}),
 db.$queryRaw<any[]>`SELECT id,name,customerId,status,startedAt,endedAt FROM Membership WHERE tenantId=${tenantId}`,
 db.customer.findMany({where:{tenantId,createdAt:{gte:a,lt:b}},select:{id:true}}),
 db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:'CUSTOMER_REFERRAL:'}}})]);
 const tipRecords=closed.length?await db.tenantSetting.findMany({where:{tenantId,settingKey:{in:closed.map(t=>'TICKET_TIPS:'+t.id)}}}):[];
 const allocations=new Map(tipRecords.map(row=>[row.settingKey.slice('TICKET_TIPS:'.length),row.value as any]));
 const sources=new Map(referrals.map(row=>[row.settingKey.slice('CUSTOMER_REFERRAL:'.length),(row.value as any)?.referralSource||'Not recorded']));
 const settlements=payments.length?await db.$queryRaw<any[]>`SELECT referenceId,entryType,amountCents FROM CustomerAccountLedger WHERE tenantId=${tenantId} AND entryType='OWED' AND amountCents<0 AND referenceId IN (${Prisma.join(payments.map(p=>p.id))})`:[];
 const [cancellationRequests,cancellationReviews]=tickets.length?await Promise.all([db.tenantSetting.findMany({where:{tenantId,settingKey:{in:tickets.map(t=>'PORTAL_CANCELLATION:'+t.id)}}}),db.auditEntry.findMany({where:{tenantId,entityType:'TICKET',entityId:{in:tickets.map(t=>t.id)},action:'CANCELLATION_REVIEW'},select:{entityId:true,occurredAt:true,details:true}})]):[[],[]];
 return {refunds:refundReport(refundRecords,a,b),membershipEnrollment:membershipEnrollment(memberships,a,b,asOf,reportTimezone),salesTax:closedTicketTax(closed),paymentRecords:paymentRecords(payments),membershipPayments:await membershipPaymentsReport(tenantId,a,b),careStages:await careStageReport(tenantId,closed),prepaid:await prepaidReport(tenantId,locationId,a,b),giftCards:await giftCardReport(tenantId,locationId,a,b,asOf),bookingRecovery:await bookingRecoveryReport(tenantId,locationId,a,b),productCosts:await productCostReport(tenantId,closed),messageDelivery:await appointmentDeliveryReport(tenantId,locationId,a,b),cancellations:cancellationReport(tickets,cancellationRequests,cancellationReviews),appointmentVolume:appointmentBreakdowns(tickets,employees,reportTimezone),...reportSummary(tickets.filter(t=>t.status!=='CANCELLED'),payments,closed,memberships,customers.map(c=>({source:sources.get(c.id)||'Not recorded'})),a,b),reconciliation:reportReconciliation(payments,closed,settlements),salesBreakdowns:salesBreakdowns(closed,employees,reportTimezone),employeeWork:{...employeeReport(employees,closed,clocks,locationId,a,b,asOf,allocations,refundRecords),scope:canManageTime?'TEAM':'SELF'}};
 }
 const [accountCustomers,openTickets]=await Promise.all([
  db.customer.findMany({where:{tenantId,OR:[{balanceCents:{gt:0}},{creditCents:{gt:0}}]},select:{id:true,firstName:true,lastName:true,active:true,balanceCents:true,creditCents:true},orderBy:{lastName:'asc'}}),
  db.ticket.findMany({where:{tenantId,locationId,status:{in:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY']}},include:{lines:true,payments:true,customer:{select:{firstName:true,lastName:true}}},orderBy:{orderNumber:'asc'}})
 ]);
 const receivables=currentReceivables(accountCustomers,openTickets,asOf);
 const [result,retention,lifetimeSales,inventory]=await Promise.all([period(start,end),retentionReport(tenantId,asOf,start,end,reportTimezone),customerLifetimeSales(tenantId,locationId,asOf),currentInventoryReport(tenantId,asOf)]);let previous;
 if(compare){let priorStart=new Date(+start-(+end-+start));if(from&&through){const days=Math.round((Date.parse(through+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000)+1;priorStart=localToInstant(new Date(Date.parse(from+'T12:00:00Z')-days*86400000).toISOString().slice(0,10)+'T00:00',location.timezone);}previous=await period(priorStart,start);}
 return {...result,receivables,retention,lifetimeSales,inventory,start,end,locationId,timezone:location.timezone,previous};
}
