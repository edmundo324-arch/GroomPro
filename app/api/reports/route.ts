import {retentionReport} from '@/src/lib/report-customer-outcomes';
import {cancellationReport} from '@/src/lib/report-cancellations';
import {appointmentBreakdowns} from '@/src/lib/report-appointments';
import {currentReceivables} from '@/src/lib/report-receivables';
import {salesBreakdowns} from '@/src/lib/report-sales-breakdowns';
import {employeeReport} from '@/src/lib/employee-report';
import type {ClockState} from '@/src/lib/time-clock';
import {Prisma} from '@prisma/client';
import {reportReconciliation} from '@/src/lib/report-reconciliation';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {requestLocation} from '@/src/lib/request-location';
import {withRequestPolicy,hidePlatformOwners} from '@/src/lib/request-policy';
import {localToInstant} from '@/src/lib/operating-hours';
import {reportSummary} from '@/src/lib/report-summary';
async function get(r:NextRequest){
 const session=await platformSession(r);if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 if(r.nextUrl.searchParams.has('locations'))return NextResponse.json({locations:await db.location.findMany({where:{tenantId:session.tenantId},select:{id:true,name:true}}),selected:session.user.locationId||''});
 const tenantId=session.tenantId,locationId=await requestLocation(r,tenantId),location=await db.location.findFirst({where:{id:locationId,tenantId}});
 if(!location)return NextResponse.json({error:'Choose a location before opening reports.'},{status:400});
 try{
 const from=r.nextUrl.searchParams.get('from'),through=r.nextUrl.searchParams.get('through');let start:Date,end:Date;
 if(from&&through){if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(through))throw Error('Choose the beginning and ending dates.');start=localToInstant(from+'T00:00',location.timezone);const next=new Date(through+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);end=localToInstant(next.toISOString().slice(0,10)+'T00:00',location.timezone);}
 else {start=new Date(r.nextUrl.searchParams.get('start')||Date.now());end=new Date(r.nextUrl.searchParams.get('end')||Date.now()+14*86400000);}
 if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start)throw Error('Choose an ending date on or after the beginning date.');
 const reportTimezone=location.timezone;
 const canManageTime=['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role);
 const employees=await db.user.findMany({where:{tenantId,...(!canManageTime?{id:session.user.id}:await hidePlatformOwners(r,tenantId)?{role:{not:'PLATFORM_OWNER' as const}}:{})},select:{id:true,firstName:true,lastName:true,displayName:true},orderBy:{lastName:'asc'}});
 const clockRecords=await db.tenantSetting.findMany({where:{tenantId,settingKey:{in:employees.map(e=>'TIME_CLOCK:'+e.id)}}});
 const clocks=new Map(clockRecords.map(row=>[row.settingKey.slice('TIME_CLOCK:'.length),row.value as unknown as ClockState]));
 const asOf=new Date();
 async function period(a:Date,b:Date){
 const [tickets,payments,closed,memberships,customers,referrals]=await Promise.all([
 db.ticket.findMany({where:{tenantId,locationId,scheduledStart:{gte:a,lt:b}},include:{lines:{include:{service:{select:{name:true}}}}}}),
 db.payment.findMany({where:{tenantId,paidAt:{gte:a,lt:b},ticket:{tenantId,locationId}}}),
 db.ticket.findMany({where:{tenantId,locationId,status:'CLOSED',closedAt:{gte:a,lt:b}},include:{lines:{include:{service:{select:{name:true}},assignedUser:true}}}}),
 db.$queryRaw<any[]>`SELECT customerId,status,startedAt,endedAt FROM Membership WHERE tenantId=${tenantId}`,
 db.customer.findMany({where:{tenantId,createdAt:{gte:a,lt:b}},select:{id:true}}),
 db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:'CUSTOMER_REFERRAL:'}}})]);
 const tipRecords=closed.length?await db.tenantSetting.findMany({where:{tenantId,settingKey:{in:closed.map(t=>'TICKET_TIPS:'+t.id)}}}):[];
 const allocations=new Map(tipRecords.map(row=>[row.settingKey.slice('TICKET_TIPS:'.length),row.value as any]));
 const sources=new Map(referrals.map(row=>[row.settingKey.slice('CUSTOMER_REFERRAL:'.length),(row.value as any)?.referralSource||'Not recorded']));
 const settlements=payments.length?await db.$queryRaw<any[]>`SELECT referenceId,entryType,amountCents FROM CustomerAccountLedger WHERE tenantId=${tenantId} AND entryType='OWED' AND amountCents<0 AND referenceId IN (${Prisma.join(payments.map(p=>p.id))})`:[];
 const [cancellationRequests,cancellationReviews]=tickets.length?await Promise.all([db.tenantSetting.findMany({where:{tenantId,settingKey:{in:tickets.map(t=>'PORTAL_CANCELLATION:'+t.id)}}}),db.auditEntry.findMany({where:{tenantId,entityType:'TICKET',entityId:{in:tickets.map(t=>t.id)},action:'CANCELLATION_REVIEW'},select:{entityId:true,occurredAt:true,details:true}})]):[[],[]];
 return {cancellations:cancellationReport(tickets,cancellationRequests,cancellationReviews),appointmentVolume:appointmentBreakdowns(tickets,employees,reportTimezone),...reportSummary(tickets.filter(t=>t.status!=='CANCELLED'),payments,closed,memberships,customers.map(c=>({source:sources.get(c.id)||'Not recorded'})),a,b),reconciliation:reportReconciliation(payments,closed,settlements),salesBreakdowns:salesBreakdowns(closed,employees,reportTimezone),employeeWork:{...employeeReport(employees,closed,clocks,locationId,a,b,asOf,allocations),scope:canManageTime?'TEAM':'SELF'}};
 }
 const [accountCustomers,openTickets]=await Promise.all([
  db.customer.findMany({where:{tenantId,OR:[{balanceCents:{gt:0}},{creditCents:{gt:0}}]},select:{id:true,firstName:true,lastName:true,active:true,balanceCents:true,creditCents:true},orderBy:{lastName:'asc'}}),
  db.ticket.findMany({where:{tenantId,locationId,status:{in:['OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY']}},include:{lines:true,payments:true,customer:{select:{firstName:true,lastName:true}}},orderBy:{orderNumber:'asc'}})
 ]);
 const receivables=currentReceivables(accountCustomers,openTickets,asOf);
 const [result,retention]=await Promise.all([period(start,end),retentionReport(tenantId,asOf,start,end,reportTimezone)]);let previous;
 if(r.nextUrl.searchParams.get('compare')==='true'){let priorStart=new Date(+start-(+end-+start));if(from&&through){const days=Math.round((Date.parse(through+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000)+1;priorStart=localToInstant(new Date(Date.parse(from+'T12:00:00Z')-days*86400000).toISOString().slice(0,10)+'T00:00',location.timezone);}previous=await period(priorStart,start);}
 return NextResponse.json({...result,receivables,retention,start,end,locationId,timezone:location.timezone,previous},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}
}
export const GET=withRequestPolicy(get,{feature:'REPORTS'});
