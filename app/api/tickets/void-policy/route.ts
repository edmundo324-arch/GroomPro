import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {voidRoles,ticketVoidPolicyKey} from '@/src/lib/ticket-void';
async function handle(r:NextRequest){const session=await platformSession(r);if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});if(!['ADMIN','MANAGER','PLATFORM_OWNER','DEVELOPER'].includes(session.user.role))return NextResponse.json({error:'An owner or manager must choose who can void tickets.'},{status:403});const tenantId=session.tenantId,where={tenantId_settingKey:{tenantId,settingKey:ticketVoidPolicyKey}};
 if(r.method==='GET'){const row=await db.tenantSetting.findUnique({where});return NextResponse.json({policy:row?.value||{revision:0,roles:[]}},{headers:{'Cache-Control':'no-store'}})}
 try{const input=await r.json(),roles=voidRoles(input.roles);const policy=await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;const old=(await tx.tenantSetting.findUnique({where}))?.value as any;if(input.revision!==(old?.revision||0))throw Error('Someone changed void access. Reopen these settings before saving.');const value={revision:input.revision+1,roles};await tx.tenantSetting.upsert({where,create:{tenantId,settingKey:ticketVoidPolicyKey,value},update:{value}});await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'TENANT',entityId:tenantId,action:'TICKET_VOID_ACCESS',summary:'Updated permitted roles for voiding unpaid tickets.',details:value}});return value});return NextResponse.json({policy});}catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}}
export const GET=withRequestPolicy(handle,{configure:true});
export const PUT=withRequestPolicy(handle,{configure:true});
