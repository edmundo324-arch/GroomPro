import {withRequestPolicy} from '@/src/lib/request-policy';
import {isPlatformAdmin} from '@/src/lib/platform-access';
import {employeeAppearance,mayPersonalize} from '@/src/lib/appearance-settings';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {workflowSettings,validateWorkflow} from '@/src/lib/workflow-settings';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {writeAudit} from '@/src/lib/audit';
const tenant=(r:NextRequest)=>r.headers.get('x-tenant-id')||process.env.GROOMPRO_DEV_TENANT_ID||'';
async function handlePolicyGET(r:NextRequest){const t=tenant(r);if(!t)return NextResponse.json({error:'Business context required.'},{status:401});const sid=r.cookies.get('groompro_session')?.value,session=sid?await getActiveEmployeeSession(t,sid):null;const businessSettings=await workflowSettings(t);return NextResponse.json({settings:await employeeAppearance(t,session?.user),businessSettings,canPersonalize:mayPersonalize(businessSettings,session?.user),canConfigure:['PLATFORM_OWNER','DEVELOPER','ADMIN'].includes(session?.user.role),canSetManufacturerColors:isPlatformAdmin(session)})}
async function handlePolicyPUT(r:NextRequest){const t=tenant(r),sid=r.cookies.get('groompro_session')?.value,session=t&&sid?await getActiveEmployeeSession(t,sid):null;if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});if(!['PLATFORM_OWNER','DEVELOPER','ADMIN'].includes(session.user.role))return NextResponse.json({error:'Manager access required.'},{status:403});try{const value=validateWorkflow(await r.json());await db.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId:t,settingKey:'WORKFLOW'}},create:{tenantId:t,settingKey:'WORKFLOW',value},update:{value}});await writeAudit({tenantId:t,actorUserId:session.user.id,entityType:'TENANT',entityId:t,action:'WORKFLOW_SETTINGS',summary:'Updated business workflow settings.'});return NextResponse.json({settings:value})}catch(e){return NextResponse.json({error:String(e)},{status:400})}}

export const GET=withRequestPolicy(handlePolicyGET, {configure:true});
export const PUT=withRequestPolicy(handlePolicyPUT, {configure:true});
