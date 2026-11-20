import {locationComparison} from '@/src/lib/report-location-comparison';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {requestLocation} from '@/src/lib/request-location';
import {withRequestPolicy,hidePlatformOwners} from '@/src/lib/request-policy';
import {localToInstant} from '@/src/lib/operating-hours';
import {reportData} from '@/src/lib/report-data';
async function get(r:NextRequest){
 const session=await platformSession(r);if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 if(r.nextUrl.searchParams.get('locations')==='compare'){if(!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role))return NextResponse.json({error:'Ask an owner or manager to compare shop reports.'},{status:403});try{return NextResponse.json(await locationComparison(session.tenantId,r.nextUrl.searchParams.get('from')||'',r.nextUrl.searchParams.get('through')||'',['PLATFORM_OWNER','DEVELOPER'].includes(session.user.role)),{headers:{'Cache-Control':'no-store'}})}catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}}
 if(r.nextUrl.searchParams.has('locations'))return NextResponse.json({locations:await db.location.findMany({where:{tenantId:session.tenantId},select:{id:true,name:true}}),selected:session.user.locationId||''});
 const tenantId=session.tenantId,locationId=await requestLocation(r,tenantId),location=await db.location.findFirst({where:{id:locationId,tenantId}});
 if(!location)return NextResponse.json({error:'Choose a location before opening reports.'},{status:400});
 try{
 const from=r.nextUrl.searchParams.get('from'),through=r.nextUrl.searchParams.get('through');let start:Date,end:Date;
 if(from&&through){if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(through))throw Error('Choose the beginning and ending dates.');start=localToInstant(from+'T00:00',location.timezone);const next=new Date(through+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);end=localToInstant(next.toISOString().slice(0,10)+'T00:00',location.timezone);}
 else {start=new Date(r.nextUrl.searchParams.get('start')||Date.now());end=new Date(r.nextUrl.searchParams.get('end')||Date.now()+14*86400000);}
 if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start)throw Error('Choose an ending date on or after the beginning date.');
 const result=await reportData({tenantId,location,start,end,userId:session.user.id,canManageTime:['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role),hideOwners:['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role)?await hidePlatformOwners(r,tenantId):false,compare:r.nextUrl.searchParams.get('compare')==='true',from,through});
 return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}
}
export const GET=withRequestPolicy(get,{feature:'REPORTS'});
