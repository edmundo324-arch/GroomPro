import {moduleLayoutSnapshot,recordModuleLayout,calendarAppearanceKeys} from '@/src/lib/module-layout-snapshot';
import {workflowSettings,validateWorkflow,workflowDefaults} from '@/src/lib/workflow-settings';
import {ticketWorkspace,defaultTicketLayout} from '@/src/lib/pos-layout';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {isPlatformRole} from '@/src/lib/roles';
import {visualModules,validateVisualLayout,layoutEqual} from '@/src/lib/visual-layout';
import {saveLayoutVersion} from '@/src/lib/visual-layout-store';
import {writeAudit} from '@/src/lib/audit';
const tenant=(r:NextRequest)=>r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
async function session(r:NextRequest){const sid=r.cookies.get('groompro_session')?.value;return sid?getActiveEmployeeSession(tenant(r),sid):null;}
async function read(r:NextRequest){const tenantId=tenant(r),s=await session(r);if(!tenantId)return NextResponse.json({error:'Business context required.'},{status:401});const rows=await db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:'MODULE_LAYOUT:'}}});const module=r.nextUrl.searchParams.get('module'),device=r.nextUrl.searchParams.get('device')==='phone'?'phone':'desktop',key=module+':'+device;
 if(module&&!s)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 const canConfigure=!!s&&['PLATFORM_OWNER','DEVELOPER','ADMIN'].includes(s.user.role);const history=module&&canConfigure?await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'LAYOUT_HISTORY:MODULE:'+module}}}):null;
 if(module&&!canConfigure)return NextResponse.json({error:'Business administrator access required.'},{status:403});
 const snapshot=module?await moduleLayoutSnapshot(db,tenantId,module):undefined;return NextResponse.json({snapshot,layouts:Object.fromEntries(rows.map(row=>[row.settingKey.slice(14),row.value])),history:history?.value||[],canConfigure,canResize:isPlatformRole(s?.user.role)},{headers:{'Cache-Control':'no-store'}});
}
async function save(r:NextRequest){const tenantId=tenant(r),s=await session(r);if(!s)return NextResponse.json({error:'Employee PIN is required.'},{status:401});if(!['PLATFORM_OWNER','DEVELOPER','ADMIN'].includes(s.user.role))return NextResponse.json({error:'Business administrator access required.'},{status:403});
 try{const body=await r.json();if(!(visualModules as readonly string[]).includes(body.module)||!['desktop','phone'].includes(body.device))throw Error('Choose an existing module and layout.');const key=body.module+':'+body.device;
 const result=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  const snapshot=await moduleLayoutSnapshot(tx,tenantId,body.module),where={tenantId_settingKey:{tenantId,settingKey:'MODULE_LAYOUT:'+key}},row=await tx.tenantSetting.findUnique({where}),previous=row?.value as any||{controls:{}};
  if(body.expected!==undefined&&!layoutEqual(body.expected,previous)||body.expectedSnapshot!==undefined&&!layoutEqual(body.expectedSnapshot,snapshot))throw Error('This layout changed elsewhere. Reopen its visual settings before saving.');
  let restore:any=null;
  if(body.restoreId){const history=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'LAYOUT_HISTORY:MODULE:'+body.module}}}))?.value as any;restore=Array.isArray(history)?history.find(h=>h.id===body.restoreId)?.value:null;if(!restore)throw Error('That saved configuration is no longer available.');}
  if(body.factory)restore={desktop:{controls:{}},phone:{controls:{}},...(body.module==='POS Ticket'?{ticket:{desktop:defaultTicketLayout(),phone:defaultTicketLayout()}}:{}),...(body.module==='Calendar'?{appearance:Object.fromEntries(calendarAppearanceKeys.map(k=>[k,workflowDefaults[k]]))}:{})};
  const developer=isPlatformRole(s.user.role),value=validateVisualLayout(body.value,developer,previous);
  if(restore){
   for(const device of ['desktop','phone'])if(device!==body.device){const requested=structuredClone(restore[device]||{controls:{}});if(!developer)requested.controls=Object.fromEntries(Object.entries(requested.controls).map(([id,r]:any)=>{const {width,height,fontSize,...rest}=r;return [id,rest]}));const other=validateVisualLayout(requested,developer,snapshot[device]);const otherWhere={tenantId_settingKey:{tenantId,settingKey:'MODULE_LAYOUT:'+body.module+':'+device}};await tx.tenantSetting.upsert({where:otherWhere,create:{tenantId,settingKey:otherWhere.tenantId_settingKey.settingKey,value:other},update:{value:other}});}
   if(restore.ticket||restore.appearance){const current=await workflowSettings(tenantId,tx),next:any={...current};if(body.module==='POS Ticket'&&restore.ticket){const placement=ticketWorkspace({...current.posLayout,...restore.ticket});if(!developer)for(const device of ['desktop','phone'] as const)placement[device].fontSize=ticketWorkspace(current.posLayout)[device].fontSize;next.posLayout=placement;}if(body.module==='Calendar'&&restore.appearance)for(const k of calendarAppearanceKeys)if(restore.appearance[k]!==undefined)next[k]=restore.appearance[k];const checked=validateWorkflow(next);await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey:'WORKFLOW'}},create:{tenantId,settingKey:'WORKFLOW',value:checked},update:{value:checked}});}
  }
  await tx.tenantSetting.upsert({where,create:{tenantId,settingKey:'MODULE_LAYOUT:'+key,value},update:{value}});
  return {value,...await recordModuleLayout(tx,tenantId,body.module,snapshot,s.user.id)};
 });
 await writeAudit({tenantId,actorUserId:s.user.id,entityType:'TENANT',entityId:tenantId,action:'MODULE_LAYOUT',summary:'Updated '+body.module+' '+body.device+' layout.'});return NextResponse.json(result);
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}
}
export const GET=withRequestPolicy(read);
export const PUT=withRequestPolicy(save,{configure:true});
