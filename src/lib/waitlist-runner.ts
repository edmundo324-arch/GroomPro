import {db} from './db';
import {waitlistPrefix,waitlistOpenings} from './waitlist';
import {platformRestriction} from './platform-restrictions';
import {isFeatureEnabled} from './feature-access';
import {zonedParts} from './operating-hours';
export type WaitlistCursor={tenantId:string;entryKey:string;date?:string};
export const waitlistOpeningPrefix='WAITLIST_OPENING:';
export async function runWaitlistMatches(cursor:WaitlistCursor|null=null){
 const tenant=await db.tenant.findFirst({where:cursor?.entryKey?{id:cursor.tenantId}:cursor?{id:{gt:cursor.tenantId}}:{},orderBy:{id:'asc'}});if(!tenant)return {cursor:null};const tenantId=tenant.id,nextTenant={tenantId,entryKey:''};
 if(await platformRestriction(tenantId)||!await isFeatureEnabled(tenantId,'ONLINE_BOOKING'))return {cursor:nextTenant};
 const row=await db.tenantSetting.findFirst({where:{tenantId,settingKey:cursor?.date?cursor.entryKey:{startsWith:waitlistPrefix,...(cursor?.entryKey?{gt:cursor.entryKey}:{})},OR:[{value:{path:'$.state',equals:'WAITING'}},{value:{path:'$.state',equals:'CONTACTED'}}]},orderBy:{settingKey:'asc'}});if(!row)return {cursor:cursor?.date?{tenantId,entryKey:cursor.entryKey}:nextTenant};const entry=row.value as any,nextEntry={tenantId,entryKey:row.settingKey};
 const [shop,customer]=await Promise.all([db.location.findFirst({where:{id:entry.locationId,tenantId},select:{timezone:true}}),db.customer.findFirst({where:{tenantId,id:entry.customerId,active:true},select:{id:true}})]);
 if(!shop||!customer)return {cursor:nextEntry};
 const today=zonedParts(new Date(),shop.timezone).date;let date=[cursor?.date||'',today,entry.from].sort().at(-1)!;const began=Date.now();let result:any={slots:[],checkedAt:new Date().toISOString()},count=0;
 try{while(date<=entry.through&&count<10&&Date.now()-began<40000){result=await waitlistOpenings(tenantId,entry,date);count++;if(result.slots.length)break;date=new Date(Date.parse(date+'T12:00:00Z')+86400000).toISOString().slice(0,10);}}
 catch{result={slots:[],checkedAt:new Date().toISOString(),error:'Review this waitlist entry: its dog, service or booking settings may have changed.'};date=entry.through+'z';}
 const more=!result.slots.length&&date<=entry.through;
 if(!more)await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM Customer WHERE id=${entry.customerId} AND tenantId=${tenantId} FOR UPDATE`;const current=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:row.settingKey}}}),v=current?.value as any;if(!v||v.revision!==entry.revision||!['WAITING','CONTACTED'].includes(v.state))return;const settingKey=waitlistOpeningPrefix+entry.id,value={entryRevision:entry.revision,checkedAt:result.checkedAt,slots:result.slots.slice(0,5),timezone:shop.timezone,...(result.error?{error:result.error}:{})};await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey}},create:{tenantId,settingKey,value},update:{value}})});
 return {cursor:more?{...nextEntry,date}:nextEntry};
}
