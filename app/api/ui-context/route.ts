import {withRequestPolicy} from '@/src/lib/request-policy';
import {NextRequest,NextResponse} from 'next/server';
import {requestLocation} from '@/src/lib/request-location';
async function handlePolicyGET(request:NextRequest){
 const tenantId=request.headers.get('x-tenant-id')||request.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
 if(!tenantId)return NextResponse.json({error:'Business context is required.'},{status:401});
 const locationId=await requestLocation(request,tenantId);
 return NextResponse.json({tenantId,locationId},{headers:{'Cache-Control':'no-store'}});
}

export const GET=withRequestPolicy(handlePolicyGET, {});
