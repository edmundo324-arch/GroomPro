import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
const prefix='CUSTOM_RULE_NOTICE:';
async function handle(r:NextRequest){
 const session=await platformSession(r);if(!session)return NextResponse.json({error:'Enter your employee PIN to view your notices.'},{status:401});const tenantId=session.tenantId,userId=session.user.id;
 if(r.method==='GET'){
  const saved=await db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:prefix}},select:{value:true}}),own=saved.map(r=>r.value as any).filter(n=>n.assigneeId===userId&&!n.readAt),ids=[...new Set<string>(own.map(n=>n.customerId).filter(Boolean))];
  const allowed=new Set(ids.length?(await db.customer.findMany({where:{tenantId,id:{in:ids}},select:{id:true}})).map(c=>c.id):[]);
  return NextResponse.json({employeeId:userId,notices:own.filter(n=>!n.customerId||allowed.has(n.customerId)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))},{headers:{'Cache-Control':'no-store'}});
 }
 try{const body=await r.json();if(!/^[a-f0-9-]{36}$/i.test(body.id||''))throw Error('Reopen your notices before marking one as read.');await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  const where={tenantId_settingKey:{tenantId,settingKey:prefix+body.id}},notice=(await tx.tenantSetting.findUnique({where}))?.value as any;
  if(!notice||notice.assigneeId!==userId||notice.customerId&&!await tx.customer.findFirst({where:{tenantId,id:notice.customerId},select:{id:true}}))throw Error('This notice is not available to your account at this shop.');
  if(!notice.readAt)await tx.tenantSetting.update({where,data:{value:{...notice,readAt:new Date().toISOString()}}});
 });return NextResponse.json({ok:true});}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}
}
export const GET=withRequestPolicy(handle,{feature:'CALENDAR'});
export const POST=withRequestPolicy(handle,{feature:'CALENDAR'});
