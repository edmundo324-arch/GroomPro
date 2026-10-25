import {platformSession,isPlatformAdmin} from './platform-access';
import {NextRequest,NextResponse} from 'next/server';
import {isFeatureEnabled} from './feature-access';
export async function moduleDenial(r:NextRequest,featureCode:string){
 const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
 if(!tenantId)return NextResponse.json({error:'Business context is required.'},{status:401});
 if(isPlatformAdmin(await platformSession(r)))return null;
 return await isFeatureEnabled(tenantId,featureCode)?null:NextResponse.json({error:'This module is not enabled for this business.'},{status:403});
}
