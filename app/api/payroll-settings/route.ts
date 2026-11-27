import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {canManageRole,isPlatformRole} from '@/src/lib/roles';
import {platformRestriction} from '@/src/lib/platform-restrictions';
import {readPayrollContext,savePayrollSettings,saveEmployeePayMethod,payrollPreparationNotice} from '@/src/lib/payroll-pay-methods';

async function actor(request:NextRequest){
 const tenantId=request.headers.get('x-tenant-id')||request.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'',sid=request.cookies.get('groompro_session')?.value;
 const session=tenantId&&sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)throw Object.assign(Error('Employee PIN is required.'),{status:401});
 if(!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role))throw Object.assign(Error('An administrator or manager must sign in to manage payroll setup.'),{status:403});
 return {tenantId,session};
}
async function employeeAccess(client:any,tenantId:string,userId:string,role:string){
 const employee=await client.user.findFirst({where:{tenantId,id:userId},select:{id:true,role:true}});
 if(!employee)throw Object.assign(Error('Employee not found.'),{status:404});
 if(!canManageRole(role,employee.role)||(!isPlatformRole(role)&&await platformRestriction(tenantId,userId)))throw Object.assign(Error('This account is managed by GroomPro support.'),{status:403});
}
const failure=(error:unknown)=>NextResponse.json({error:error instanceof Error?error.message:'Payroll settings could not be saved.'},{status:(error as {status?:number})?.status||400});
const reply=(context:any)=>NextResponse.json({...context,preparationNotice:payrollPreparationNotice},{headers:{'Cache-Control':'no-store'}});
async function get(request:NextRequest){
 try{const {tenantId,session}=await actor(request),userId=request.nextUrl.searchParams.get('userId')||'';if(userId)await employeeAccess(db,tenantId,userId,session.user.role);return reply(await readPayrollContext(db,tenantId,userId||undefined))}catch(error){return failure(error)}
}
async function put(request:NextRequest){
 try{
  const {tenantId,session}=await actor(request),input=await request.json();if(input.scope!=='BUSINESS'&&input.scope!=='EMPLOYEE')throw Error('Choose business or employee payroll settings.');
  const context=await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
   const userId=input.scope==='EMPLOYEE'?String(input.userId||''):'';if(input.scope==='EMPLOYEE'){if(!userId)throw Error('Choose an employee.');await employeeAccess(tx,tenantId,userId,session.user.role);}
   const saved=input.scope==='EMPLOYEE'?await saveEmployeePayMethod(tx,tenantId,userId,input):await savePayrollSettings(tx,tenantId,input);
   await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:userId?'USER':'TENANT',entityId:userId||tenantId,action:'PAYROLL_PAY_METHOD_UPDATED',summary:userId?'Updated employee payroll pay method.':'Updated business payroll pay-method setup.',details:userId?{method:saved.employee?.method}:{mode:saved.settings.mode,commonMethod:saved.settings.commonMethod}}});
   return saved;
  });return reply(context);
 }catch(error){return failure(error)}
}
export const GET=withRequestPolicy(get,{configure:true});
export const PUT=withRequestPolicy(put,{configure:true});
