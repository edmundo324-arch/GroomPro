import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {hidePlatformOwners,withRequestPolicy} from '@/src/lib/request-policy';
import {staffTaskPrefix,staffTaskPolicyKey,taskManager,taskVisible,changeTask,type StaffTask} from '@/src/lib/staff-tasks';
const reply=(data:object,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function handle(r:NextRequest){
 const session=await platformSession(r);if(!session)return reply({error:'Enter your employee PIN.'},401);
 const tenantId=session.tenantId,userId=session.user.id,manager=taskManager(session.user.role),hide=await hidePlatformOwners(r,tenantId);
 const location=await db.location.findFirst({where:{tenantId,...(session.user.locationId?{id:session.user.locationId}:{})},orderBy:{createdAt:'asc'},select:{timezone:true}}),timezone=location?.timezone||'America/Chicago';
 if(r.method==='GET'){
  const [policy,employees,records]=await Promise.all([db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:staffTaskPolicyKey}}}),db.user.findMany({where:{tenantId,...(hide?{role:{not:'PLATFORM_OWNER' as const}}:{})},select:{id:true,displayName:true,firstName:true,lastName:true,active:true},orderBy:{lastName:'asc'}}),db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:staffTaskPrefix}}})]);
  const anyEmployeeCanAssign=(policy?.value as any)?.anyEmployeeCanAssign===true;
  return reply({employeeId:userId,timezone,manager,anyEmployeeCanAssign,canAssignOthers:manager||anyEmployeeCanAssign,employees,tasks:records.map(r=>r.value as unknown as StaffTask).filter(t=>taskVisible(t,userId,manager)&&employees.some(e=>e.id===t.assigneeId)).sort((a,b)=>Number(!!a.completedAt)-Number(!!b.completedAt)||(a.dueDate||'9999').localeCompare(b.dueDate||'9999')||b.createdAt.localeCompare(a.createdAt))});
 }
 try{const input=await r.json();if(!/^[a-f0-9-]{36}$/i.test(input.id||''))throw Error('Reopen the task before saving.');
 const task=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  const where={tenantId_settingKey:{tenantId,settingKey:staffTaskPrefix+input.id}},row=await tx.tenantSetting.findUnique({where}),previous=row?.value as unknown as StaffTask|undefined;
  const policy=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:staffTaskPolicyKey}}}),canAssignOthers=manager||(policy?.value as any)?.anyEmployeeCanAssign===true;
  const next=changeTask(previous,input,{id:userId,manager,canAssignOthers,timezone},new Date().toISOString());
  if(input.action==='SAVE'&&!await tx.user.findFirst({where:{tenantId,id:next.assigneeId,active:true,...(hide?{role:{not:'PLATFORM_OWNER' as const}}:{})}}))throw Error('Choose an active employee in this business.');
  if(input.action!=='SAVE'&&!await tx.user.findFirst({where:{tenantId,id:next.assigneeId,...(hide?{role:{not:'PLATFORM_OWNER' as const}}:{})}}))throw Error('This task is not available to your account.');
  await tx.tenantSetting.upsert({where,create:{tenantId,settingKey:staffTaskPrefix+input.id,value:next},update:{value:next}});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:userId,entityType:'USER',entityId:next.assigneeId,action:'STAFF_TASK_'+input.action,summary:input.action==='SAVE'?'Saved staff task.':input.action==='COMPLETE'?'Completed staff task.':'Reopened staff task.',details:{taskId:next.id,previousRevision:previous?.revision||0,revision:next.revision}}});return next;
 });return reply({task});}catch(e){return reply({error:(e as Error).message},409);}
}
export const GET=withRequestPolicy(handle,{feature:'CALENDAR'});
export const POST=withRequestPolicy(handle,{feature:'CALENDAR'});
