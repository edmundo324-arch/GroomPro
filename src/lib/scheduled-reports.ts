import {db} from './db';
import {scheduledReportPolicy} from './scheduled-report-policy';
export const reportSchedulePrefix='REPORT_SCHEDULE:';
export async function saveReportSchedule(tenantId:string,actor:string,input:any){
 if(!/^[a-f0-9-]{36}$/i.test(input.id||''))throw Error('Reopen scheduled reports before adding this schedule.');const policy=scheduledReportPolicy(input.policy);
 if(policy.locationId&&!await db.location.findFirst({where:{id:policy.locationId,tenantId}}))throw Error('Choose a shop belonging to this business.');
 return db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;const settingKey=reportSchedulePrefix+input.id,where={tenantId_settingKey:{tenantId,settingKey}},old=(await tx.tenantSetting.findUnique({where}))?.value as any;
 if((old?.revision||0)!==input.revision)throw Error('Another person changed this schedule. Your edits are still here; reopen it to review the saved version.');
 if(!old&&await tx.tenantSetting.count({where:{tenantId,settingKey:{startsWith:reportSchedulePrefix}}})>=50)throw Error('This business already has 50 report schedules. Edit an existing schedule.');
 const effectiveFrom=new Date().toISOString();
 const history=old?[...(old.history||[]),{id:old.id,revision:old.revision,policy:old.policy,actor:old.actor,enabledAt:old.enabledAt,effectiveFrom:old.effectiveFrom||old.enabledAt,effectiveTo:effectiveFrom}]:[];
 const value={id:input.id,revision:(old?.revision||0)+1,policy,actor,effectiveFrom,history,enabledAt:policy.enabled?(old?.policy?.enabled?old.enabledAt:effectiveFrom):null};await tx.tenantSetting.upsert({where,create:{tenantId,settingKey,value},update:{value}});await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:actor,entityType:'TENANT',entityId:tenantId,action:'REPORT_SCHEDULE',summary:'Updated scheduled staff report delivery.',details:{id:input.id,enabled:policy.enabled,revision:value.revision}}});return value;});
}
