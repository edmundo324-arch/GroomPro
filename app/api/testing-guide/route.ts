import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {platformSession,isPlatformAdmin} from '@/src/lib/platform-access';
import {businessId} from '@/src/lib/business-context';
import {guideItems,guideStatuses} from '@/src/lib/testing-guide';
const prefix='TEST_GUIDE_RESULT:';
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export const GET=withRequestPolicy(async(r:NextRequest)=>{
 const actor=await platformSession(r);if(!actor)return reply({error:'Employee PIN is required.'},401);
 const platform=isPlatformAdmin(actor),business=await db.tenant.findUnique({where:{id:actor.tenantId},select:{id:true,name:true}});
 const all=r.nextUrl.searchParams.get('all')==='true';if(all&&!platform)return reply({error:'Only GroomPro owner/developer access can review feedback across businesses.'},403);
 const rows=await db.tenantSetting.findMany({where:{...(all?{}:{tenantId:actor.tenantId}),settingKey:{startsWith:prefix}}});
 const companies=await db.tenant.findMany({where:{id:{in:[...new Set([actor.tenantId,...rows.map(v=>v.tenantId)])]}},select:{id:true,name:true}});
 return reply({businessId:actor.tenantId,businessName:platform&&!businessId(actor.tenantId)?'GroomPro':business?.name||'GroomPro',platform,results:rows.map(row=>({businessId:row.tenantId,businessName:companies.find(c=>c.id===row.tenantId)?.name||'',testId:row.settingKey.slice(prefix.length),...(row.value as object)}))});
});
export const PUT=withRequestPolicy(async(r:NextRequest)=>{
 const actor=await platformSession(r);if(!actor)return reply({error:'Employee PIN is required.'},401);
 try{const b=await r.json();if(!guideItems.some(i=>i.id===b.testId)||!guideStatuses.includes(b.status)||typeof b.notes!=='string'||b.notes.length>12000||!Number.isInteger(b.revision)||b.revision<0)return reply({error:'Choose a test result and keep notes within 12,000 characters.'},400);
 const tenantId=actor.tenantId,settingKey=prefix+b.testId;
 const result=await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;const old=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey}}}))?.value as any;if((old?.revision||0)!==b.revision)return {conflict:true};
 const value={status:b.status,notes:b.notes,revision:b.revision+1,updatedAt:new Date().toISOString(),employeeName:[actor.user.firstName,actor.user.lastName].filter(Boolean).join(' '),employeeId:actor.user.id};await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey}},create:{tenantId,settingKey,value},update:{value}});await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:actor.user.id,entityType:'TENANT',entityId:tenantId,action:'TEST_GUIDE_FEEDBACK',summary:'Saved testing guide feedback for test '+b.testId,details:{testId:b.testId,status:b.status,revision:value.revision}}});return value;});
 if('conflict' in result)return reply({error:'Someone updated this test while you were writing. Your notes are still here. Refresh the saved feedback before replacing it.'},409);return reply({result});
 }catch{return reply({error:'These testing notes could not be saved. Keep your notes open and try again.'},400)}
});
