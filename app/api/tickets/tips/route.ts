import {ticketSettledCents} from '@/src/lib/ticket-settlement';
import {ticketRefundHistory} from '@/src/lib/ticket-refunds';
import {redeemGiftCard} from '@/src/lib/gift-cards';
import {NextRequest,NextResponse} from 'next/server';
import {createHash,randomUUID} from 'node:crypto';
import {db} from '@/src/lib/db';
import {withRequestPolicy,hidePlatformOwners} from '@/src/lib/request-policy';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {requestLocation} from '@/src/lib/request-location';
import {readPlannedPackages} from '@/src/lib/planned-package-store';
import {tipTeam,dogTipTeams,validateTipShares} from '@/src/lib/ticket-tips';
const key=(id:string)=>'TICKET_TIPS:'+id;
async function context(r:NextRequest){const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';const session=await getActiveEmployeeSession(tenantId,r.cookies.get('groompro_session')?.value||'');const locationId=await requestLocation(r,tenantId);if(!session||!locationId)throw Error('Sign in and choose the ticket’s location.');return {tenantId,locationId,session};}
async function employees(r:NextRequest,tenantId:string){return db.user.findMany({where:{tenantId,active:true,...(await hidePlatformOwners(r,tenantId)?{role:{not:'PLATFORM_OWNER' as const}}:{})},select:{id:true,firstName:true,lastName:true,displayName:true}});}
async function get(r:NextRequest){try{const {tenantId,locationId,session}=await context(r),ticketId=r.nextUrl.searchParams.get('ticketId')||'';if(!ticketId){const rolePercentages=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'TIP_ROLE_PERCENTAGES'}}}))?.value||{};const fullWashPercentages=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'TIP_FULL_WASH_PERCENTAGES'}}}))?.value||{};return NextResponse.json({rolePercentages,fullWashPercentages,canConfigure:['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role)});}const ticket=await db.ticket.findFirst({where:{id:ticketId,tenantId,locationId},include:{lines:true}});if(!ticket)return NextResponse.json({error:'Ticket not found.'},{status:404});const row=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:key(ticketId)}}});const allocation:any=row?.value||{revision:0,shares:[]};const plans=await readPlannedPackages(tenantId,ticketId),team=tipTeam(ticket.lines,plans),dogs=dogTipTeams(ticket.lines,plans);const rolePercentages=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'TIP_ROLE_PERCENTAGES'}}}))?.value||{};const fullWashPercentages=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'TIP_FULL_WASH_PERCENTAGES'}}}))?.value||{};const refundedTipCents=(await ticketRefundHistory(db,tenantId,ticketId)).reduce((sum:number,r:any)=>sum+r.tipCents,0);return NextResponse.json({tipCents:Math.max(0,ticket.tipCents-refundedTipCents),refundedTipCents,status:ticket.status,allocation,employees:(await employees(r,tenantId)).filter(u=>team.some(t=>t.userId===u.id)||allocation.shares.some((s:any)=>s.userId===u.id)),workedUserIds:team.map(t=>t.userId),team,dogs,rolePercentages,fullWashPercentages,canConfigure:['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role)});}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
async function post(r:NextRequest){try{
 const {tenantId,locationId,session}=await context(r),body=await r.json(),ticketId=String(body.ticketId||'');
 if(!/^[a-f0-9-]{36}$/i.test(body.requestId||''))throw Error('Reopen the tip form and try again.');
 if(!['ALLOCATE','ADD'].includes(body.action))throw Error('Choose whether to assign a tip or record an additional tip.');
 const hash=createHash('sha256').update(JSON.stringify([session.user.id,locationId,body])).digest('hex'),requestKey='tip:'+body.requestId;
 const allowed=new Set((await employees(r,tenantId)).map(u=>u.id));
 const result=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticketId} AND tenantId=${tenantId} FOR UPDATE`;
  const ticket=await tx.ticket.findFirst({where:{id:ticketId,tenantId,locationId},include:{lines:true,payments:true}});if(!ticket)throw Error('Ticket not found.');
  const prior=await tx.posOperation.findUnique({where:{tenantId_requestKey:{tenantId,requestKey}}});if(prior){if(prior.requestHash!==hash)throw Error('This tip was already submitted with different details.');return prior.response;}
  if(['CANCELLED','NO_SHOW','VOID'].includes(ticket.status))throw Error('This ticket cannot receive a tip.');
  const row=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:key(ticketId)}}}),saved:any=row?.value||{revision:0,shares:[]};
  const refundedTipCents=(await ticketRefundHistory(tx,tenantId,ticketId)).reduce((sum:number,r:any)=>sum+r.tipCents,0),remainingTipCents=Math.max(0,ticket.tipCents-refundedTipCents);
  if(body.revision!==saved.revision||body.expectedTipCents!==remainingTipCents)throw Error('The ticket tip changed. Close and reopen this form to review the saved amounts.');
  const adding=body.action==='ADD',editing=!adding&&ticket.status!=='CLOSED'&&body.tipCents!==undefined,amount=adding?body.amountCents:editing?body.tipCents:remainingTipCents;
  const team=tipTeam(ticket.lines,await readPlannedPackages(tenantId,ticketId,tx));const teamIds=new Set(team.map(t=>t.userId));for(const old of saved.shares||[])teamIds.add(old.userId);
  const eligible=new Set([...allowed].filter(id=>teamIds.has(id)));
  if(editing&&refundedTipCents)throw Error('Review refunded tips before changing this ticket tip.');
  if(!Number.isSafeInteger(amount)||amount<0||amount>2147483647||adding&&amount===0||ticket.tipCents+(adding?amount:0)>2147483647)throw Error('Enter a valid tip amount.');
  if(adding&&ticket.status!=='CLOSED')throw Error('Use the ticket’s Tip field before checkout. Additional tips are recorded after checkout.');
  const shares=validateTipShares(body.shares,amount,eligible);
  if(adding){if(!['CASH','VISA','MASTERCARD','AMEX','DISCOVER','DEBIT','GIFT_CARD','OTHER'].includes(body.paymentType))throw Error('Choose how the additional tip was received.');const payment=await tx.payment.create({data:{tenantId,ticketId,amount:(amount/100).toFixed(2),paymentType:body.paymentType}});if(body.paymentType==='GIFT_CARD')await redeemGiftCard(tx,{tenantId,ticketId,locationId,code:body.giftCardCode,amountCents:amount,paymentId:payment.id,actorUserId:session.user.id});await tx.ticket.update({where:{id:ticketId},data:{tipCents:ticket.tipCents+amount,totalCents:ticket.totalCents+amount}});}
  if(editing&&ticket.totalCents-ticket.tipCents+amount<ticketSettledCents(ticket))throw Error('This tip change would reduce the ticket below the amount already paid. Review the payment before changing the tip.');
  if(editing)await tx.ticket.update({where:{id:ticketId},data:{tipCents:amount,totalCents:ticket.totalCents-ticket.tipCents+amount}});
  const merged=new Map<string,number>();if(adding)for(const share of saved.shares||[])merged.set(share.userId,share.amountCents);for(const share of shares)merged.set(share.userId,(merged.get(share.userId)||0)+share.amountCents);
  const allocation={revision:saved.revision+1,shares:[...merged].map(([userId,amountCents])=>({userId,amountCents}))};
  await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey:key(ticketId)}},create:{tenantId,settingKey:key(ticketId),value:allocation},update:{value:allocation}});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:session.user.id,entityType:'TICKET',entityId:ticketId,action:adding?'ADDITIONAL_TIP':'TIP_ALLOCATION',summary:adding?'Recorded an additional tip and its employee shares.':'Assigned the ticket tip to employees.',details:{amountCents:amount,shares,before:saved,...(adding?{paymentType:body.paymentType}:{})}}});
  const response={ok:true,allocation,tipCents:editing?amount:remainingTipCents+(adding?amount:0),refundedTipCents};await tx.posOperation.create({data:{id:randomUUID(),tenantId,requestKey,requestHash:hash,status:'DONE',response,responseStatus:200}});return response;
 },{timeout:30000});return NextResponse.json(result);
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
export const GET=withRequestPolicy(get,{feature:'TICKETS'});
export const POST=withRequestPolicy(post,{feature:'TICKETS'});

export const PUT=withRequestPolicy(async(r:NextRequest)=>{try{
 const {tenantId,session}=await context(r);
 if(!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role))return NextResponse.json({error:'Ask an owner or manager to save role percentages.'},{status:403});
 const {percentages,profile='GROOMING'}=await r.json();if(!['GROOMING','FULL_WASH'].includes(profile))throw Error('Choose Grooming or Full Wash.');
 if(!percentages||Array.isArray(percentages)||Object.keys(percentages).length>30||Object.entries(percentages).some(([role,v])=>!role||role.length>80||typeof v!=='number'||!Number.isFinite(v)||v<0||v>100)||Math.abs(Object.values(percentages).reduce<number>((sum,v)=>sum+Number(v),0)-100)>0.00001)throw Error('Enter role percentages totaling 100%.');
 const key={tenantId,settingKey:profile==='FULL_WASH'?'TIP_FULL_WASH_PERCENTAGES':'TIP_ROLE_PERCENTAGES'};await db.tenantSetting.upsert({where:{tenantId_settingKey:key},create:{...key,value:percentages},update:{value:percentages}});
 return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}},{feature:'TICKETS',configure:true});
