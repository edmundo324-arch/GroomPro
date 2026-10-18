import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {workflowSettings} from '@/src/lib/workflow-settings';

export async function POST(request:NextRequest){
 const origin=request.headers.get('origin');
 const expectedOrigin=process.env.GROOMPRO_APP_ORIGIN?new URL(process.env.GROOMPRO_APP_ORIGIN).origin:request.nextUrl.origin;
 if(origin&&origin!==expectedOrigin)return NextResponse.json({error:'Invalid origin.'},{status:403});
 const tenantId=request.headers.get('x-tenant-id')||process.env.GROOMPRO_DEV_TENANT_ID||'';
 const id=request.cookies.get('groompro_session')?.value,deviceId=request.cookies.get('groompro_device')?.value;
 if(!tenantId||!id||!deviceId)return new NextResponse(null,{status:401});
 const settings=await workflowSettings(tenantId),now=new Date();
 // Atomic condition: activity cannot revive expired/replaced sessions or consume a per-action grant.
 const result=await db.employeeSession.updateMany({where:{id,tenantId,deviceId,endedAt:null,user:{active:true},lastActiveAt:{gte:new Date(+now-settings.inactivityMinutes*60000)}},data:{lastActiveAt:now}});
 return new NextResponse(null,{status:result.count?204:401});
}
