import {createHash} from 'node:crypto';
import {db} from './db';
import {isFeatureEnabled} from './feature-access';
import {platformRestriction} from './platform-restrictions';
import {customerEmailConfig} from './customer-email';
import {reportData} from './report-data';
import {reportRows} from './report-export';
import {localToInstant} from './operating-hours';
import {sharingScope,sharingKey,sharedLocations,type SharingConfig} from './customer-sharing-context';
import {scheduledReportChoices,dueReportPeriods,scheduledReportPolicy} from './scheduled-report-policy';
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function scheduledReportHtml(data:any,location:string,reports:string[]){const prefixes=scheduledReportChoices.filter(c=>reports.includes(c.id)).flatMap(c=>c.prefixes),rows=reportRows(data,location).filter((r,i)=>i<8||prefixes.some(p=>String(r[0]).startsWith(p)));return '<!doctype html><html><body><h1>GroomPro staff report</h1><p>Sales and activity cover the dates below. Balances, inventory and retention are current snapshots, as labelled. This is not a payroll payment or a tax filing.</p><table cellpadding="6" style="border-collapse:collapse">'+rows.map(r=>'<tr>'+r.map(v=>'<td style="border:1px solid #dce4ea">'+escape(v)+'</td>').join('')+'</tr>').join('')+'</table></body></html>';}
export async function runScheduledReports(cursor:{tenantId:string;entryKey:string}|null=null,now=new Date()){
 const rows=await db.tenantSetting.findMany({where:{settingKey:{startsWith:'REPORT_SCHEDULE:'},...(cursor?{OR:[{tenantId:{gt:cursor.tenantId}},{tenantId:cursor.tenantId,settingKey:{gt:cursor.entryKey}}]}:{})},orderBy:[{tenantId:'asc'},{settingKey:'asc'}],take:5});const deadline=Date.now()+45000;let last=cursor;
 for(const row of rows){if(Date.now()>deadline)break;const previous=last;const tenantId=row.tenantId;last={tenantId,entryKey:row.settingKey};try{
 const currentSchedule=row.value as any;if(!currentSchedule.policy?.enabled)continue;
 if(await platformRestriction(tenantId)||!await isFeatureEnabled(tenantId,'REPORTS'))continue;
 for(const saved of [...(currentSchedule.history||[]),currentSchedule]){
 const policy=scheduledReportPolicy(saved.policy);if(!policy.enabled||!saved.enabledAt)continue;
 const actor=await db.user.findFirst({where:{tenantId,id:saved.actor,active:true}});if(!actor||!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(actor.role))continue;
 const permissions=await db.rolePermission.findMany({where:{tenantId,role:actor.role,permissionCode:{in:['VIEW','CONFIGURE']}}});if(!['PLATFORM_OWNER','DEVELOPER'].includes(actor.role)&&permissions.some(p=>p.enabled===false))continue;
 const location=await db.location.findFirst({where:{tenantId,id:policy.locationId}});if(!location)continue;
 const config=customerEmailConfig(tenantId);if(!config)continue;
 const progressKey='REPORT_PROGRESS:'+saved.id+':'+saved.revision,progress=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:progressKey}}}))?.value as any;
 const until=saved.effectiveTo?new Date(Math.min(+now,+new Date(saved.effectiveTo)-1)):now;
 for(const period of dueReportPeriods(policy,until,location.timezone,saved.effectiveFrom||saved.enabledAt,progress?.revision===saved.revision?progress.through:undefined)){
 if(Date.now()>deadline)return {cursor:previous};
 const deliveryId=(recipient:string)=>createHash('sha256').update(tenantId+':'+row.settingKey+':'+period.key+':'+recipient).digest('hex');const pending:string[]=[];for(const recipient of policy.recipients){if(!await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'REPORT_DELIVERY:'+deliveryId(recipient)}}}))pending.push(recipient);}if(pending.length){
 const next=new Date(period.through+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);const start=localToInstant(period.from+'T00:00',location.timezone),end=localToInstant(next.toISOString().slice(0,10)+'T00:00',location.timezone);
 const sharing=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:sharingKey}}}))?.value as SharingConfig|undefined;
 const build=()=>reportData({tenantId,location,start,end,userId:actor.id,canManageTime:true,hideOwners:true});let data;
 if(sharing?.enabled){const locations=sharedLocations(sharing,location.id);if(!locations.length)continue;data=await sharingScope.run({tenantId,locationId:location.id,locations},build);}else data=await build();
 const html=scheduledReportHtml(data,location.name,policy.reports),tenant=await db.tenant.findUniqueOrThrow({where:{id:tenantId},select:{name:true}});
 // A successful preparation resolves only this schedule's earlier preparation warning. Delivery history remains intact.
 await db.tenantSetting.deleteMany({where:{tenantId,settingKey:'REPORT_RUNTIME:'+row.settingKey.slice('REPORT_SCHEDULE:'.length)}});
 for(const recipient of pending){if(Date.now()>deadline)return {cursor:previous};const id=deliveryId(recipient),settingKey='REPORT_DELIVERY:'+id,where={tenantId_settingKey:{tenantId,settingKey}};
 const value={scheduleId:saved.id,scheduleRevision:saved.revision,recipient,period,createdAt:now.toISOString(),status:'SENDING',message:'A delivery attempt was started. If no result appears, check the email service before sending another copy.'};
 const claimed=await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;const current=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:row.settingKey}}}))?.value as any;if(current?.revision!==currentSchedule.revision||!current?.policy?.enabled||await tx.tenantSetting.findUnique({where}))return false;await tx.tenantSetting.create({data:{tenantId,settingKey,value}});return true;});if(!claimed)continue;
 let status='UNKNOWN',message='The email result is uncertain. Check the email service before sending another copy.';
 try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.apiKey,'Content-Type':'application/json','Idempotency-Key':'report-'+id},body:JSON.stringify({from:config.from,to:[recipient],subject:tenant.name+' · '+location.name+' reports · '+period.from+' to '+period.through,html}),signal:AbortSignal.timeout(12000)});if(response.ok){const result=await response.json();if(typeof result.id==='string'){status='ACCEPTED';message='The email service accepted this report; delivery is not confirmed.';}}else if(response.status<500&&response.status!==408){status='FAILED';message='The email service rejected this report. Check its delivery settings.';}}catch{}
 await db.tenantSetting.update({where,data:{value:{...value,status,message}}});
 }
 }
 await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;const current=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:row.settingKey}}}))?.value as any;if(current?.revision!==currentSchedule.revision)return;const where={tenantId_settingKey:{tenantId,settingKey:progressKey}},old=(await tx.tenantSetting.findUnique({where}))?.value as any;if(old?.revision===saved.revision&&old.through>=period.key)return;const value={revision:saved.revision,through:period.key};await tx.tenantSetting.upsert({where,create:{tenantId,settingKey:progressKey,value},update:{value}});});
 }
 }
 }catch{await db.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey:'REPORT_RUNTIME:'+row.settingKey.slice('REPORT_SCHEDULE:'.length)}},create:{tenantId,settingKey:'REPORT_RUNTIME:'+row.settingKey.slice('REPORT_SCHEDULE:'.length),value:{checkedAt:now.toISOString(),message:'This report could not be prepared. Review its shop and settings; GroomPro will check again.'}},update:{value:{checkedAt:now.toISOString(),message:'This report could not be prepared. Review its shop and settings; GroomPro will check again.'}}}).catch(()=>{});}}
 return {cursor:rows.length>0&&(rows.length===5||last?.entryKey!==rows.at(-1)?.settingKey)?last:null};
}
