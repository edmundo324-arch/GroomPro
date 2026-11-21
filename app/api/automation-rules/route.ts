import {customRuleHistory} from '@/src/lib/custom-rule-history';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy,hidePlatformOwners} from '@/src/lib/request-policy';
import {customRulePrefix} from '@/src/lib/custom-rule-policy';
import {saveCustomRuleDraft,changeCustomRuleState} from '@/src/lib/custom-rule-store';
import {readTagCatalog} from '@/src/lib/customer-tags';
async function handle(r:NextRequest){const session=await platformSession(r);if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});if(!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role))return NextResponse.json({error:'An owner or manager must sign in to configure automatic rules.'},{status:403});const tenantId=session.tenantId,hide=await hidePlatformOwners(r,tenantId);
 if(r.method==='GET'){const [records,employees,locations,catalog,services,packages,plans]=await Promise.all([db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:customRulePrefix}},select:{value:true}}),db.user.findMany({where:{tenantId,active:true,...(hide?{role:{not:'PLATFORM_OWNER' as const}}:{})},select:{id:true,firstName:true,lastName:true,displayName:true},orderBy:{lastName:'asc'}}),db.location.findMany({where:{tenantId},select:{id:true,name:true}}),readTagCatalog(tenantId),db.service.findMany({where:{tenantId,active:true},select:{id:true,name:true},orderBy:{name:'asc'}}),db.package.findMany({where:{tenantId,active:true},select:{id:true,name:true},orderBy:{name:'asc'}}),db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:'VIP_PLAN:'}},select:{settingKey:true,value:true}})]);return NextResponse.json({rules:records.map(r=>r.value),history:await customRuleHistory(db,tenantId),employees,locations,services,packages,vipPlans:plans.filter(r=>(r.value as any)?.active).map(r=>({id:r.settingKey.slice(9),name:(r.value as any).name})),tags:catalog.tags.filter(t=>t.active)},{headers:{'Cache-Control':'no-store'}});}
 try{const saved=await (r.method==='POST'?changeCustomRuleState:saveCustomRuleDraft)(tenantId,session.user.id,await r.json(),hide);return NextResponse.json({saved},{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
export const GET=withRequestPolicy(handle,{configure:true});
export const PUT=withRequestPolicy(handle,{configure:true});

export const POST=withRequestPolicy(handle,{configure:true});
