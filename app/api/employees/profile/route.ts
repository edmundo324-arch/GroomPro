import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {canManageRole,isPlatformRole} from '@/src/lib/roles';
import {platformRestriction} from '@/src/lib/platform-restrictions';
import {employeeHrFields,employeeHrKey,employeeProfileFields,employeeProfileSelect} from '@/src/lib/employee-profile-fields';

async function handleGET(request:NextRequest){
 const tenantId=request.headers.get('x-tenant-id')||request.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'',sid=request.cookies.get('groompro_session')?.value;
 const session=tenantId&&sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 if(!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role))return NextResponse.json({error:'An administrator or manager must sign in to view employee details.'},{status:403});
 const id=request.nextUrl.searchParams.get('userId')||'';
 if(!id)return NextResponse.json({error:'Choose an employee.'},{status:400});
 const employee=await db.user.findFirst({where:{tenantId,id},select:{id:true,role:true,...employeeProfileSelect}});
 if(!employee)return NextResponse.json({error:'Employee not found.'},{status:404});
 if(!canManageRole(session.user.role,employee.role)||(!isPlatformRole(session.user.role)&&await platformRestriction(tenantId,id)))return NextResponse.json({error:'This account is managed by GroomPro support.'},{status:403});
 const row=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:employeeHrKey(id)}}}),raw=(row?.value||{}) as Record<string,unknown>;
 const hr=Object.fromEntries(employeeHrFields.map(key=>[key,typeof raw[key]==='string'?raw[key]:null]));
 return NextResponse.json({employee:{id:employee.id,...Object.fromEntries(employeeProfileFields.map(key=>[key,employee[key]])),hr}},{headers:{'Cache-Control':'no-store'}});
}
export const GET=withRequestPolicy(handleGET,{});
