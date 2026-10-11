import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {requestLocation} from '@/src/lib/request-location';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {workflowSettings} from '@/src/lib/workflow-settings';
import {nextTicketNumber} from '@/src/lib/ticket-number';
const tenant=(r:NextRequest)=>r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
export async function GET(r:NextRequest){
 const tenantId=tenant(r),locationId=await requestLocation(r,tenantId);
 if(!tenantId||!locationId)return NextResponse.json({error:'Business context required.'},{status:401});
 const id=r.nextUrl.searchParams.get('id');
 const drafts=await db.posDraft.findMany({where:{tenantId,locationId,promotedAt:null,...(id?{id}:{})},orderBy:{updatedAt:'desc'}});
 return NextResponse.json({drafts},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(r:NextRequest){
 const tenantId=tenant(r),locationId=await requestLocation(r,tenantId),sid=r.cookies.get('groompro_session')?.value;
 if(!tenantId||!locationId)return NextResponse.json({error:'Business context required.'},{status:401});
 if(!sid||!await getActiveEmployeeSession(tenantId,sid))return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 const body=await r.json();
 if(!/^[a-zA-Z0-9-]{16,80}$/.test(body.requestKey||''))return NextResponse.json({error:'Invalid draft request.'},{status:400});
 const draft=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  const existing=await tx.posDraft.findUnique({where:{tenantId_requestKey:{tenantId,requestKey:body.requestKey}}});
  if(existing)return existing;
  return tx.posDraft.create({data:{tenantId,locationId,requestKey:body.requestKey,orderNumber:await nextTicketNumber(tx,tenantId),payload:{}}});
 });
 return NextResponse.json({draft});
}
export async function PUT(r:NextRequest){
 const tenantId=tenant(r),sid=r.cookies.get('groompro_session')?.value;
 const session=sid?await db.employeeSession.findFirst({where:{id:sid,tenantId,endedAt:null,user:{active:true}}}):null;
 const policy=await workflowSettings(tenantId);
 if(!session||Date.now()-Number(session.lastActiveAt)>policy.inactivityMinutes*60000)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 const body=await r.json();
 if(!body.payload||typeof body.payload!=='object'||JSON.stringify(body.payload).length>250000)return NextResponse.json({error:'Invalid ticket details.'},{status:400});
 const result=await db.posDraft.updateMany({where:{id:String(body.id||''),tenantId,promotedAt:null},data:{payload:body.payload}});
 return NextResponse.json({saved:!!result.count},{status:result.count?200:409});
}
