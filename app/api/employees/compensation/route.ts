import {Prisma} from '@prisma/client';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {employeeQualification} from '@/src/lib/employee-compensation';
import {validateCompensation} from '@/src/lib/compensation-rules';
import {writeAudit} from '@/src/lib/audit';
const tenant=(r:NextRequest)=>r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||'';
async function access(r:NextRequest){const tenantId=tenant(r),sid=r.cookies.get('groompro_session')?.value;const session=tenantId&&sid?await getActiveEmployeeSession(tenantId,sid):null;return {tenantId,session}}
function visible(result:Awaited<ReturnType<typeof employeeQualification>>){const {employee,...rest}=result;return{...rest,dateOfHire:employee.dateOfHire}}
export async function GET(r:NextRequest){const {tenantId,session}=await access(r);if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});if(!['ADMIN','MANAGER'].includes(session.user.role))return NextResponse.json({error:'Manager access required.'},{status:403});try{return NextResponse.json(visible(await employeeQualification(tenantId,r.nextUrl.searchParams.get('userId')||'')))}catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}}
export async function POST(r:NextRequest){
 const {tenantId,session}=await access(r);if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});if(!['ADMIN','MANAGER'].includes(session.user.role))return NextResponse.json({error:'Manager access required.'},{status:403});
 try{const b=await r.json(),id=String(b.userId||'');const current=await employeeQualification(tenantId,id);if(b.action==='VIEW')return NextResponse.json(visible(current));
  const rules=b.rules===null?null:validateCompensation(b.rules);if(rules){delete rules.approvedPercent;if(current.rules?.approvedPercent!==undefined)rules.approvedPercent=current.rules.approvedPercent;}
  const dates=Array.isArray(b.workedDates)?[...new Set<string>(b.workedDates)]:current.workedDates;
  if(dates.length>3660||dates.some(d=>typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d+'T12:00:00Z'))||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d||d>current.through))throw Error('Use valid past or current worked dates.');
  const dateOfHire=b.dateOfHire?new Date(String(b.dateOfHire)+'T12:00:00Z'):null;if(dateOfHire&&!Number.isFinite(+dateOfHire))throw Error('Invalid hire date.');
  await db.$transaction(async tx=>{await tx.user.update({where:{id},data:{dateOfHire,compensationRules:rules===null?Prisma.DbNull:rules as any}});const key={tenantId,settingKey:'EMPLOYEE_WORK_DAYS:'+id};await tx.tenantSetting.upsert({where:{tenantId_settingKey:key},create:{...key,value:dates},update:{value:dates}});if(rules&&b.approveQualification){const updated=await employeeQualification(tenantId,id,new Date(),tx);rules.approvedPercent=updated.qualification?.qualifiedPercent??rules.basePercent;await tx.user.update({where:{id},data:{compensationRules:rules as any}})}});
  await writeAudit({tenantId,actorUserId:session.user.id,entityType:'USER',entityId:id,action:'COMPENSATION_UPDATED',summary:'Updated employee compensation and recorded worked dates.',details:{before:current.rules,after:rules,workedDates:dates,approval:!!b.approveQualification}});
  return NextResponse.json(visible(await employeeQualification(tenantId,id)));
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}
}
