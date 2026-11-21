import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {marketingLimit,marketingLimitKey,readMarketingLimit} from '@/src/lib/marketing-limit';
async function handle(r:NextRequest){
 const session=await platformSession(r);if(!session)return NextResponse.json({error:'Enter your employee PIN to review marketing limits.'},{status:401});
 const tenantId=session.tenantId,canEdit=['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role);
 if(r.method==='GET')return NextResponse.json({...await readMarketingLimit(db,tenantId),canEdit},{headers:{'Cache-Control':'no-store'}});
 if(!canEdit)return NextResponse.json({error:'An owner or manager must sign in to change marketing limits.'},{status:403});
 try{const input=marketingLimit(await r.json());const value=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  const current=await readMarketingLimit(tx,tenantId);if(input.revision!==current.revision)throw Error('These limits changed elsewhere. Reopen them to review the saved choice.');
  const value={...input,revision:current.revision+1},where={tenantId_settingKey:{tenantId,settingKey:marketingLimitKey}};
  await tx.tenantSetting.upsert({where,create:{tenantId,settingKey:marketingLimitKey,value},update:{value}});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'TENANT',entityId:tenantId,action:'MARKETING_LIMIT_CHANGED',summary:'Updated the customer marketing-message limit.',details:{before:current,after:value}}});return value;
 });return NextResponse.json({...value,canEdit});}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}
}
export const GET=withRequestPolicy(handle,{feature:'MESSAGING'});
export const PUT=withRequestPolicy(handle,{feature:'MESSAGING'});
