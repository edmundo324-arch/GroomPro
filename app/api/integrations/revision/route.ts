import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {requestLocation} from '@/src/lib/request-location';
import {withRequestPolicy} from '@/src/lib/request-policy';
export const GET=withRequestPolicy(async(request:NextRequest)=>{
 const session=await platformSession(request);if(!session)return NextResponse.json({error:'Employee session required.'},{status:401});
 const tenantId=session.tenantId,locationId=await requestLocation(request,tenantId);
 const row=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'123PET_DATA_REVISION'}}});
 return NextResponse.json({scope:tenantId+':'+locationId,revision:(row?.value as any)?.revision||''},{headers:{'Cache-Control':'no-store'}});
});
