import {moduleLayoutSnapshot,recordModuleLayout,calendarAppearanceKeys} from '@/src/lib/module-layout-snapshot';
import {layoutEqual} from '@/src/lib/visual-layout';
import {applyBusinessTiming} from '@/src/lib/business-ticket-timing';
import {saveLayoutVersion} from '@/src/lib/visual-layout-store';
import {preserveTicketSizes} from '@/src/lib/visual-layout';
import {ticketWorkspace} from '@/src/lib/pos-layout';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {isPlatformAdmin} from '@/src/lib/platform-access';
import {employeeAppearance,mayPersonalize} from '@/src/lib/appearance-settings';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {workflowSettings,validateWorkflow} from '@/src/lib/workflow-settings';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {writeAudit} from '@/src/lib/audit';
const tenant=(r:NextRequest)=>r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
async function handlePolicyGET(r:NextRequest){const t=tenant(r);if(!t)return NextResponse.json({error:'Business context required.'},{status:401});const sid=r.cookies.get('groompro_session')?.value,session=sid?await getActiveEmployeeSession(t,sid):null;const businessSettings=await workflowSettings(t);const canConfigure=['PLATFORM_OWNER','DEVELOPER','ADMIN'].includes(session?.user.role);const posHistory=canConfigure&&r.nextUrl.searchParams.get('history')==='pos'?await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:t,settingKey:'LAYOUT_HISTORY:POS_LAYOUT'}}}):null;return NextResponse.json({posLayoutHistory:posHistory?.value||[],settings:await employeeAppearance(t,session?.user),businessSettings,canPersonalize:mayPersonalize(businessSettings,session?.user),canConfigure:['PLATFORM_OWNER','DEVELOPER','ADMIN'].includes(session?.user.role),canResize:isPlatformAdmin(session),canSetManufacturerColors:isPlatformAdmin(session)})}
async function handlePolicyPUT(r:NextRequest){
 const t=tenant(r),sid=r.cookies.get('groompro_session')?.value,session=t&&sid?await getActiveEmployeeSession(t,sid):null;
 if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 if(!['PLATFORM_OWNER','DEVELOPER','ADMIN'].includes(session.user.role))return NextResponse.json({error:'Manager access required.'},{status:403});
 try{const body=await r.json();const result=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${t} FOR UPDATE`;
  const previous=await workflowSettings(t,tx),value=validateWorkflow(body.posLayoutOnly?{...previous,posLayout:body.posLayout}:body);
  const previousPos=await moduleLayoutSnapshot(tx,t,'POS Ticket',previous),previousCalendar=await moduleLayoutSnapshot(tx,t,'Calendar',previous);
  preserveTicketSizes(value.posLayout,ticketWorkspace(previous.posLayout),isPlatformAdmin(session));
  const posLayoutHistory=JSON.stringify(value.posLayout)!==JSON.stringify(previous.posLayout)?await saveLayoutVersion(tx,t,'POS_LAYOUT',value.posLayout,previous.posLayout,session.user.id):(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:t,settingKey:'LAYOUT_HISTORY:POS_LAYOUT'}}}))?.value||[];
  const changedTickets=body.posLayoutOnly?0:await applyBusinessTiming(tx,t,value.timingMode as 'SEQUENTIAL'|'CONCURRENT');
  await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId:t,settingKey:'WORKFLOW'}},create:{tenantId:t,settingKey:'WORKFLOW',value},update:{value}});
  if(!layoutEqual(previousPos.ticket,{desktop:value.posLayout.desktop,phone:value.posLayout.phone}))await recordModuleLayout(tx,t,'POS Ticket',previousPos,session.user.id);
  if(calendarAppearanceKeys.some(k=>!layoutEqual(previous[k],value[k])))await recordModuleLayout(tx,t,'Calendar',previousCalendar,session.user.id);
  return {settings:value,changedTickets,posLayoutHistory};
 },{timeout:60000});
 await writeAudit({tenantId:t,actorUserId:session.user.id,entityType:'TENANT',entityId:t,action:'WORKFLOW_SETTINGS',summary:'Updated business workflow settings.',details:{changedOpenTickets:result.changedTickets}});
 return NextResponse.json(result);
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}
}

export const GET=withRequestPolicy(handlePolicyGET, {configure:true});
export const PUT=withRequestPolicy(handlePolicyPUT, {configure:true});
