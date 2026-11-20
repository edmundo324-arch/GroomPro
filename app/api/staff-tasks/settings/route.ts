import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {staffTaskPolicyKey,taskManager} from '@/src/lib/staff-tasks';
export const PUT=withRequestPolicy(async(r:NextRequest)=>{
 const session=await platformSession(r);if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});if(!taskManager(session.user.role))return NextResponse.json({error:'An owner or manager can change task assignment rules.'},{status:403});
 try{const b=await r.json();if(typeof b.anyEmployeeCanAssign!=='boolean'||typeof b.previous!=='boolean')throw Error('Choose who may assign tasks.');await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${session.tenantId} FOR UPDATE`;const where={tenantId_settingKey:{tenantId:session.tenantId,settingKey:staffTaskPolicyKey}},row=await tx.tenantSetting.findUnique({where});if(((row?.value as any)?.anyEmployeeCanAssign===true)!==b.previous)throw Error('Another person changed this rule. Refresh tasks before saving.');const value={anyEmployeeCanAssign:b.anyEmployeeCanAssign};await tx.tenantSetting.upsert({where,create:{tenantId:session.tenantId,settingKey:staffTaskPolicyKey,value},update:{value}});await tx.auditEntry.create({data:{tenantId:session.tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'TENANT',entityId:session.tenantId,action:'STAFF_TASK_POLICY',summary:'Updated who may assign staff tasks.',details:value}})});return NextResponse.json({saved:true});}catch(e){return NextResponse.json({error:(e as Error).message},{status:409});}
},{feature:'CALENDAR',configure:true});
