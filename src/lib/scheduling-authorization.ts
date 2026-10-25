import {NextRequest} from 'next/server';
import {schedulingApproved} from './scheduling-warning';
import {workflowSettings} from './workflow-settings';
import {getActiveEmployeeSession} from './employee-session';
export async function approvedScheduling(r:NextRequest,message:string){
 if(!schedulingApproved(r,message))return false;
 const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
 const sid=r.cookies.get('groompro_session')?.value||'';
 const session=tenantId&&sid?await getActiveEmployeeSession(tenantId,sid):null;if(!session)return false;
 const s=await workflowSettings(tenantId);return ['PLATFORM_OWNER','DEVELOPER'].includes(session.user.role)||s.warningOverrideRoles.includes(session.user.role)||s.warningOverrideEmployees.includes(session.user.id);
}
