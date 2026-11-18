import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {requestLocation} from '@/src/lib/request-location';
import {withRequestPolicy} from '@/src/lib/request-policy';
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
 async function period(a:Date,b:Date){
 const [tickets,payments,closed,memberships,customers,referrals]=await Promise.all([
 db.ticket.findMany({where:{tenantId,locationId,scheduledStart:{gte:a,lt:b},status:{not:'CANCELLED'}},include:{lines:true}}),
 db.payment.findMany({where:{tenantId,paidAt:{gte:a,lt:b},ticket:{tenantId,locationId}}}),
 db.ticket.findMany({where:{tenantId,locationId,status:'CLOSED',closedAt:{gte:a,lt:b}},include:{lines:{include:{service:{select:{name:true}},assignedUser:true}}}}),
 db.$queryRaw<any[]>`SELECT customerId,status,startedAt,endedAt FROM Membership WHERE tenantId=${tenantId}`,
 db.customer.findMany({where:{tenantId,createdAt:{gte:a,lt:b}},select:{id:true}}),
 db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:'CUSTOMER_REFERRAL:'}}})]);
 const sources=new Map(referrals.map(row=>[row.settingKey.slice('CUSTOMER_REFERRAL:'.length),(row.value as any)?.referralSource||'Not recorded']));
 return reportSummary(tickets,payments,closed,memberships,customers.map(c=>({source:sources.get(c.id)||'Not recorded'})),a,b);
 }
 const result=await period(start,end);let previous;
 if(r.nextUrl.searchParams.get('compare')==='true'){let priorStart=new Date(+start-(+end-+start));if(from&&through){const days=Math.round((Date.parse(through+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000)+1;priorStart=localToInstant(new Date(Date.parse(from+'T12:00:00Z')-days*86400000).toISOString().slice(0,10)+'T00:00',location.timezone);}previous=await period(priorStart,start);}
 return NextResponse.json({...result,start,end,locationId,previous},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}
}
export const GET=withRequestPolicy(get,{feature:'REPORTS'});
