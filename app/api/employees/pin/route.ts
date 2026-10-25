import {isPlatformRole,canManageRole} from '@/src/lib/roles';
import {NextRequest,NextResponse} from 'next/server';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {db} from '@/src/lib/db';
import {openPin,pinVaultKey} from '@/src/lib/pin-vault';
import {platformRestriction} from '@/src/lib/platform-restrictions';
import {writeAudit} from '@/src/lib/audit';
async function handle(r:NextRequest){
 const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
 const actor=await getActiveEmployeeSession(tenantId,r.cookies.get('groompro_session')?.value||'');
 if(!actor)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 if(!['PLATFORM_OWNER','DEVELOPER','ADMIN'].includes(actor.user.role))return NextResponse.json({error:'Owner access is required to view or remove employee PINs.'},{status:403});
 try{
  const b=await r.json(),id=String(b.userId||'');
  if(!['REVEAL','REMOVE'].includes(b.action))throw Error('Choose a PIN action.');
  const user=await db.user.findFirst({where:{id,tenantId}});if(!user)throw Error('Employee not found.');
  if(!canManageRole(actor.user.role,user.role))throw Error('Only a Platform Owner can manage Owner credentials; Developer credentials require platform authority.');
  if(b.action==='REMOVE'&&id===actor.user.id)throw Error('Another owner or Developer must remove your sign-in PIN.');
  if(!isPlatformRole(actor.user.role)&&await platformRestriction(tenantId,id))throw Error('This account is managed by GroomPro support.');
  const settingKey=pinVaultKey(id);let pin:string|undefined;
  if(b.action==='REVEAL'){const row=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey}}});pin=openPin(row?.value,tenantId,id)}
  else await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;await tx.user.update({where:{id},data:{pinHash:'PIN_REMOVED',pinPrefixHashes:[]}});await tx.tenantSetting.deleteMany({where:{tenantId,settingKey}});await tx.employeeSession.updateMany({where:{tenantId,userId:id,endedAt:null},data:{endedAt:new Date()}})});
  await writeAudit({tenantId,actorUserId:actor.user.id,entityType:'USER',entityId:id,action:b.action==='REVEAL'?'PIN_VIEWED':'PIN_REMOVED',summary:b.action==='REVEAL'?'Owner viewed employee PIN.':'Owner removed employee sign-in PIN.'});
  return NextResponse.json({ok:true,...(pin?{pin}:{})},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400,headers:{'Cache-Control':'no-store'}})}
}
export const POST=withRequestPolicy(handle,{configure:true});
