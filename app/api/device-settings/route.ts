import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {isPlatformRole} from '@/src/lib/roles';
import {businessOwnerKey} from '@/src/lib/platform-business';
import {devicePolicyKey,deviceEmailVerifiedKey,hashDevicePassword} from '@/src/lib/device-password';
async function handle(r:NextRequest){
 const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
 const session=await getActiveEmployeeSession(tenantId,r.cookies.get('groompro_session')?.value||'');
 const owner=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:businessOwnerKey}}});
 if(!session||!isPlatformRole(session.user.role)&&(owner?.value as any)?.userId!==session.user.id)return NextResponse.json({error:'The business owner manages verification for new devices.'},{status:403});
 const where={tenantId_settingKey:{tenantId,settingKey:devicePolicyKey}};
 if(r.method==='GET'){
  const [row,ready]=await Promise.all([db.tenantSetting.findUnique({where}),db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:deviceEmailVerifiedKey}}})]);
  const policy=row?.value as any;
  return NextResponse.json({mode:policy?.mode||'EMAIL',hasPassword:!!policy?.passwordHash,ready:ready?.value===true,revision:policy?.revision||0},{headers:{'Cache-Control':'no-store'}});
 }
 try{
  const b=await r.json();if(!['EMAIL','PASSWORD'].includes(b.mode))throw Error('Choose email code or password.');
  const passwordHash=b.password?await hashDevicePassword(String(b.password)):undefined;
  const result=await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
   if((await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:deviceEmailVerifiedKey}}}))?.value!==true)throw Error('Verify the first device with an owner email code before changing this setting.');
   const previous=(await tx.tenantSetting.findUnique({where}))?.value as any;
   if((previous?.revision||0)!==b.revision)throw Error('This setting changed. Reopen Device access before saving.');
   const value={mode:b.mode,passwordHash:passwordHash||previous?.passwordHash||'',revision:(previous?.revision||0)+1};
   if(value.mode==='PASSWORD'&&!value.passwordHash)throw Error('Set a device password before choosing password verification.');
   await tx.tenantSetting.upsert({where,create:{tenantId,settingKey:devicePolicyKey,value},update:{value}});
   await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'TENANT',entityId:tenantId,action:'DEVICE_POLICY',summary:'Updated verification for additional devices.'}});
   return {mode:value.mode,hasPassword:!!value.passwordHash,revision:value.revision,ready:true};
  });return NextResponse.json(result);
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}
}
export const GET=withRequestPolicy(handle,{configure:true});
export const PUT=withRequestPolicy(handle,{configure:true});
