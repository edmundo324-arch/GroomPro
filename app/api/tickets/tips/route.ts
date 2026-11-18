import {NextRequest,NextResponse} from 'next/server';
import {createHash,randomUUID} from 'node:crypto';
import {db} from '@/src/lib/db';
import {withRequestPolicy,hidePlatformOwners} from '@/src/lib/request-policy';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {requestLocation} from '@/src/lib/request-location';
import {validateTipShares} from '@/src/lib/ticket-tips';
const key=(id:string)=>'TICKET_TIPS:'+id;
async function context(r:NextRequest){const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';const session=await getActiveEmployeeSession(tenantId,r.cookies.get('groompro_session')?.value||'');const locationId=await requestLocation(r,tenantId);if(!session||!locationId)throw Error('Sign in and choose the ticket’s location.');return {tenantId,locationId,session};}
async function employees(r:NextRequest,tenantId:string){return db.user.findMany({where:{tenantId,active:true,...(await hidePlatformOwners(r,tenantId)?{role:{not:'PLATFORM_OWNER' as const}}:{})},select:{id:true,firstName:true,lastName:true,displayName:true}});}
async function get(r:NextRequest){try{const {tenantId,locationId}=await context(r),ticketId=r.nextUrl.searchParams.get('ticketId')||'';const ticket=await db.ticket.findFirst({where:{id:ticketId,tenantId,locationId},include:{lines:true}});if(!ticket)return NextResponse.json({error:'Ticket not found.'},{status:404});const row=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:key(ticketId)}}});const allocation:any=row?.value||{revision:0,shares:[]};return NextResponse.json({tipCents:ticket.tipCents,status:ticket.status,allocation,employees:await employees(r,tenantId),workedUserIds:[...new Set(ticket.lines.map(l=>l.assignedUserId).filter(Boolean))]});}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
async function post(r:NextRequest){try{
 const {tenantId,locationId,session}=await context(r),body=await r.json(),ticketId=String(body.ticketId||'');
 if(!/^[a-f0-9-]{36}$/i.test(body.requestId||''))throw Error('Reopen the tip form and try again.');
 if(!['ALLOCATE','ADD'].includes(body.action))throw Error('Choose whether to assign a tip or record an additional tip.');
 const hash=createHash('sha256').update(JSON.stringify([session.user.id,locationId,body])).digest('hex'),requestKey='tip:'+body.requestId;
 const allowed=new Set((await employees(r,tenantId)).map(u=>u.id));
 const result=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticketId} AND tenantId=${tenantId} FOR UPDATE`;
  const ticket=await tx.ticket.findFirst({where:{id:ticketId,tenantId,locationId}});if(!ticket)throw Error('Ticket not found.');
  const prior=await tx.posOperation.findUnique({where:{tenantId_requestKey:{tenantId,requestKey}}});if(prior){if(prior.requestHash!==hash)throw Error('This tip was already submitted with different details.');return prior.response;}
  if(['CANCELLED','NO_SHOW'].includes(ticket.status))throw Error('This ticket cannot receive a tip.');
  const row=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:key(ticketId)}}}),saved:any=row?.value||{revision:0,shares:[]};
  if(body.revision!==saved.revision||body.expectedTipCents!==ticket.tipCents)throw Error('The ticket tip changed. Close and reopen this form to review the saved amounts.');
  const adding=body.action==='ADD',amount=adding?body.amountCents:ticket.tipCents;
  if(!Number.isSafeInteger(amount)||amount<0||adding&&amount===0||ticket.tipCents+(adding?amount:0)>2147483647)throw Error('Enter a valid tip amount.');
  if(adding&&ticket.status!=='CLOSED')throw Error('Use the ticket’s Tip field before checkout. Additional tips are recorded after checkout.');
  const shares=validateTipShares(body.shares,amount,allowed);
  if(adding){if(!['CASH','VISA','MASTERCARD','AMEX','DISCOVER','DEBIT','GIFT_CARD','OTHER'].includes(body.paymentType))throw Error('Choose how the additional tip was received.');await tx.payment.create({data:{tenantId,ticketId,amount:(amount/100).toFixed(2),paymentType:body.paymentType}});await tx.ticket.update({where:{id:ticketId},data:{tipCents:ticket.tipCents+amount,totalCents:ticket.totalCents+amount}});}
  const merged=new Map<string,number>();if(adding)for(const share of saved.shares||[])merged.set(share.userId,share.amountCents);for(const share of shares)merged.set(share.userId,(merged.get(share.userId)||0)+share.amountCents);
  const allocation={revision:saved.revision+1,shares:[...merged].map(([userId,amountCents])=>({userId,amountCents}))};
  await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey:key(ticketId)}},create:{tenantId,settingKey:key(ticketId),value:allocation},update:{value:allocation}});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'TICKET',entityId:ticketId,action:adding?'ADDITIONAL_TIP':'TIP_ALLOCATION',summary:adding?'Recorded an additional tip and its employee shares.':'Assigned the ticket tip to employees.',details:{amountCents:amount,shares,before:saved,...(adding?{paymentType:body.paymentType}:{})}}});
  const response={ok:true,allocation,tipCents:ticket.tipCents+(adding?amount:0)};await tx.posOperation.create({data:{id:randomUUID(),tenantId,requestKey,requestHash:hash,status:'DONE',response,responseStatus:200}});return response;
 },{timeout:30000});return NextResponse.json(result);
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
export const GET=withRequestPolicy(get,{feature:'TICKETS'});
export const POST=withRequestPolicy(post,{feature:'TICKETS'});
