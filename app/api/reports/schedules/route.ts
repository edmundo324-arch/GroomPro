import {NextRequest,NextResponse} from 'next/server';
import {customerEmailConfig} from '@/src/lib/customer-email';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {reportSchedulePrefix,saveReportSchedule} from '@/src/lib/scheduled-reports';
async function handle(r:NextRequest){const s=await platformSession(r),reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});if(!s)return reply({error:'Enter your employee PIN.'},401);if(!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(s.user.role))return reply({error:'Ask an owner or manager to set up scheduled staff reports.'},403);
 try{if(r.method==='GET'){const rows=await db.tenantSetting.findMany({where:{tenantId:s.tenantId,settingKey:{startsWith:reportSchedulePrefix}}}),locations=await db.location.findMany({where:{tenantId:s.tenantId},select:{id:true,name:true}}),deliveries=await db.tenantSetting.findMany({where:{tenantId:s.tenantId,settingKey:{startsWith:'REPORT_DELIVERY:'}},orderBy:{id:'desc'},take:20});const runtime=await db.tenantSetting.findMany({where:{tenantId:s.tenantId,settingKey:{startsWith:'REPORT_RUNTIME:'}}});return reply({runtime:runtime.map(r=>r.value),emailConfigured:!!customerEmailConfig(s.tenantId),schedules:rows.map(r=>r.value),locations,deliveries:deliveries.map(r=>r.value)});}return reply({saved:await saveReportSchedule(s.tenantId,s.user.id,await r.json())});}catch(e){return reply({error:(e as Error).message},400);}}
export const GET=withRequestPolicy(handle,{feature:'REPORTS'});
export const PUT=withRequestPolicy(handle,{feature:'REPORTS',configure:true});
