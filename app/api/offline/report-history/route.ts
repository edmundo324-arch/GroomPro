import {sharingScope} from '@/src/lib/customer-sharing-context';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy,hidePlatformOwners} from '@/src/lib/request-policy';
import {requestLocation} from '@/src/lib/request-location';
import {reportHistoryParts,type ReportHistoryPart} from '@/src/lib/offline-report-history';
import {reportHistoryPage} from '@/src/lib/offline-report-source';
async function get(request:NextRequest){
 const session=await platformSession(request);if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});
 const part=request.nextUrl.searchParams.get('part') as ReportHistoryPart,after=request.nextUrl.searchParams.get('after')||'';
 if(!reportHistoryParts.includes(part)||after.length>191)return NextResponse.json({error:'Reconnect to prepare reporting history.'},{status:400});
 const tenantId=session.tenantId,locationId=await requestLocation(request,tenantId),location=await db.location.findFirst({where:{id:locationId,tenantId},select:{id:true,name:true,timezone:true}});
 if(!location)return NextResponse.json({error:'Choose a shop before preparing reporting history.'},{status:400});
 const canManageTime=['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role);
 const page=await reportHistoryPage(tenantId,locationId,session.user.id,canManageTime,canManageTime?await hidePlatformOwners(request,tenantId):false,part,after);
 return NextResponse.json({version:1,accessKey:JSON.stringify([session.user.role,sharingScope.getStore()?.locations?.slice().sort()||null]),scope:{tenantId,locationId,employeeId:session.user.id},location,canManageTime,asOf:new Date().toISOString(),part,...page},{headers:{'Cache-Control':'no-store'}});
}
export const GET=withRequestPolicy(get,{feature:'REPORTS'});
