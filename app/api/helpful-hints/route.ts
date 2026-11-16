import {NextRequest,NextResponse} from 'next/server';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {db} from '@/src/lib/db';
async function read(request:NextRequest){
 const tenantId=request.headers.get('x-tenant-id')||request.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID;
 if(!tenantId)return NextResponse.json({error:'Business context required.'},{status:401});
 const row=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'WORKFLOW'}}});
 return NextResponse.json({enabled:(row?.value as any)?.helpfulHints!==false},{headers:{'Cache-Control':'no-store'}});
}
export const GET=withRequestPolicy(read,{});
