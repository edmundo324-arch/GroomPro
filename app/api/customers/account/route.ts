import { NextRequest, NextResponse } from "next/server";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";
import { addAccountEntry, adjustAccountEntry, adjustRewardPoints, getCustomerAccount } from "@/src/lib/customer-account";
import { writeAudit } from "@/src/lib/audit";

const COOKIE="groompro_session";
const tenantFrom=(r:NextRequest)=>r.headers.get("x-tenant-id")||process.env.GROOMPRO_DEV_TENANT_ID||"";

export async function GET(request:NextRequest){
 const tenantId=tenantFrom(request);const customerId=request.nextUrl.searchParams.get("customerId")||"";
 if(!tenantId||!customerId)return NextResponse.json({error:"Tenant and customer are required."},{status:400});
 const account=await getCustomerAccount(tenantId,customerId);
 if(!account)return NextResponse.json({error:"Customer could not be found."},{status:404});
 return NextResponse.json(account);
}

export async function POST(request:NextRequest){
 const tenantId=tenantFrom(request);const sid=request.cookies.get(COOKIE)?.value||"";const session=tenantId&&sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return NextResponse.json({error:"Employee PIN is required."},{status:401});
 if(!["ADMIN","MANAGER"].includes(session.user.role))return NextResponse.json({error:"Manager approval is required for customer account adjustments."},{status:403});
 try{
  const body=await request.json();const customerId=String(body.customerId||"");const reason=String(body.reason||"").trim();const action=String(body.action||"ACCOUNT");
  if(!customerId||!reason)return NextResponse.json({error:"Customer and reason are required."},{status:400});
  if(action==="REWARD_POINTS"){
   const points=Math.round(Number(body.points));if(!Number.isInteger(points)||points===0)return NextResponse.json({error:"Reward point adjustment must be a non-zero whole number."},{status:400});
   const result=await adjustRewardPoints({tenantId,customerId,actorUserId:session.user.id,points,reason});
   await writeAudit({tenantId,actorUserId:session.user.id,entityType:"CUSTOMER",entityId:customerId,customerId,action:"REWARD_POINT_ADJUSTMENT",summary:`Adjusted Secret Rewards by ${points>0?"+":""}${points} points.`,details:{points,reason,newPoints:result.newPoints}});
   return NextResponse.json(await getCustomerAccount(tenantId,customerId));
  }
  const entryType=String(body.entryType||"") as "OWED"|"CREDIT";const amountCents=Math.round(Number(body.amountCents));
  if(!["OWED","CREDIT"].includes(entryType)||!Number.isInteger(amountCents)||amountCents===0)return NextResponse.json({error:"Choose Owed or Credit and enter a non-zero whole-cent adjustment."},{status:400});
  const result=await adjustAccountEntry({tenantId,customerId,actorUserId:session.user.id,entryType,amountCents,reason});
  await writeAudit({tenantId,actorUserId:session.user.id,entityType:"CUSTOMER",entityId:customerId,customerId,action:"ACCOUNT_ADJUSTMENT",summary:`Adjusted ${entryType} by $${Math.abs(amountCents/100).toFixed(2)} (${amountCents>0?"increase":"decrease"}).`,details:{entryType,amountCents,reason,ledgerId:result.id,newBalanceCents:entryType==="OWED"?result.newCents:undefined,newCreditCents:entryType==="CREDIT"?result.newCents:undefined}});
  return NextResponse.json(await getCustomerAccount(tenantId,customerId));
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to adjust customer account."},{status:400});}
}
