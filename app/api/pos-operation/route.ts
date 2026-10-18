import {createHash,randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {actionContext} from '@/src/lib/action-context';
import {POST as createTicket} from '../tickets/route';
import {POST as checkout} from '../tickets/checkout/route';
import {POST as rebook} from '../tickets/rebook/route';
import {POST as enroll} from '../memberships/route';
import {PATCH as changeStatus} from '../tickets/status/route';
import {POST as noShow} from '../tickets/no-show/route';
import {POST as rewards} from '../customers/rewards/route';

export async function POST(request:NextRequest){
 const tenantId=request.headers.get('x-tenant-id')||request.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
 const sid=request.cookies.get('groompro_session')?.value||'';
 const session=tenantId&&sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 let body:any;try{body=await request.json()}catch{return NextResponse.json({error:'Invalid operation.'},{status:400})}
 if(!['SAVE','PAYMENT','CLOSE','REBOOK','REDEEM','ENROLL','STATUS','NO_SHOW'].includes(body.kind)||! /^[a-zA-Z0-9-]{16,80}$/.test(body.requestKey||''))return NextResponse.json({error:'Choose a valid ticket action.'},{status:400});
 const {requestKey,...intent}=body;
 const requestHash=createHash('sha256').update(JSON.stringify(intent)).digest('hex');
 const key={tenantId,requestKey};
 async function replay(){
  const existing=await db.posOperation.findUnique({where:{tenantId_requestKey:key}});
  if(!existing||existing.requestHash!==requestHash)return NextResponse.json({error:'This request key belongs to a different action.'},{status:409});
  if(existing.status!=='DONE')return NextResponse.json({error:'This action is still processing or needs verification. Do not submit another payment. Reopen the ticket to check its history.',operationPending:true,...(existing.response as object||{})},{status:409});
  return NextResponse.json(existing.response,{status:existing.responseStatus||200});
 }
 if(await db.posOperation.findUnique({where:{tenantId_requestKey:key}}))return replay();
 try{await db.posOperation.create({data:{id:randomUUID(),...key,requestHash}})}catch(error){if((error as any).code==='P2002')return replay();throw error}
 return actionContext.run({tenantId,session},async()=>{
  let ticketId=String(body.ticketId||'');
  const call=async(handler:(r:NextRequest)=>Promise<Response>,path:string,payload:any,method="POST")=>{
   const headers=new Headers(request.headers);headers.set('content-type','application/json');
   return handler(new NextRequest(new URL(path,request.url),{method,headers,body:JSON.stringify(payload)}));
  };
  const complete=async(response:Response)=>{
   const data=await response.json();
   if(body.kind==='ENROLL'&&data.ticketId)ticketId=data.ticketId;
   const result={...data,...(ticketId?{savedTicketId:ticketId}:{})};
   if(data.schedulingWarning){
    // Scheduling rejected before the requested transaction; permit only an explicit override retry.
    await db.posOperation.delete({where:{tenantId_requestKey:key}});
    return NextResponse.json(result,{status:response.status});
   }
   await db.posOperation.update({where:{tenantId_requestKey:key},data:{status:'DONE',response:result,responseStatus:response.status}});
   return NextResponse.json(result,{status:response.status});
  };
  try{
   if(!ticketId&&body.kind==='ENROLL'&&!body.draft?.lines?.length)return complete(await call(enroll,'/api/memberships',{...(body.details||{}),draftId:body.draft?.draftId}));
   if(!ticketId){
    if(!body.draft)return complete(NextResponse.json({error:'Ticket details are required.'},{status:400}));
    const created=await call(createTicket,'/api/tickets',body.draft);
    if(!created.ok)return complete(created);
    const data=await created.json();ticketId=data.ticket.id;
    await db.posOperation.update({where:{tenantId_requestKey:key},data:{response:{savedTicketId:ticketId}}});
    if(body.kind==='SAVE')return complete(NextResponse.json(data));
   }else if(!await db.ticket.findFirst({where:{id:ticketId,tenantId}}))return complete(NextResponse.json({error:'Ticket not found.'},{status:404}));
   const details={...(body.details||{}),ticketId};
   if(body.kind==='PAYMENT'||body.kind==='CLOSE')return complete(await call(checkout,'/api/tickets/checkout',{...details,action:body.kind}));
   if(body.kind==='REBOOK')return complete(await call(rebook,'/api/tickets/rebook',details));
   if(body.kind==='ENROLL')return complete(await call(enroll,'/api/memberships',details));
   if(body.kind==='STATUS')return complete(await call(changeStatus,'/api/tickets/status',details,'PATCH'));
   if(body.kind==='NO_SHOW')return complete(await call(noShow,'/api/tickets/no-show',details));
   if(body.kind==='REDEEM')return complete(await call(rewards,'/api/customers/rewards',{...details,action:'REDEEM'}));
   return complete(NextResponse.json({ticket:await db.ticket.findFirst({where:{id:ticketId,tenantId}})}));
  }catch{
   // Leave RUNNING durable: a process failure must never trigger a second payment.
   return NextResponse.json({error:'The action needs verification. Check ticket history before attempting another payment.',operationPending:true,savedTicketId:ticketId||undefined},{status:409});
  }
 });
}

export async function GET(request:NextRequest){
 const tenantId=request.headers.get('x-tenant-id')||request.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
 const sid=request.cookies.get('groompro_session')?.value||'';
 if(!tenantId||!sid||!await getActiveEmployeeSession(tenantId,sid))return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 const requestKey=request.nextUrl.searchParams.get('requestKey')||'';
 const operation=await db.posOperation.findUnique({where:{tenantId_requestKey:{tenantId,requestKey}}});
 return NextResponse.json(operation?{status:operation.status,response:operation.response,responseStatus:operation.responseStatus}:{status:'UNKNOWN'},{headers:{'Cache-Control':'no-store'}});
}
