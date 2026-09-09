import { NextRequest, NextResponse } from "next/server";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";
import { addAccountEntry, getCustomerAccount } from "@/src/lib/customer-account";
import { writeAudit } from "@/src/lib/audit";

const COOKIE="groompro_session";
const tenantFrom=(r:NextRequest)=>r.headers.get("x-tenant-id")||process.env.GROOMPRO_DEV_TENANT_ID||"";

export async function GET(request:NextRequest){
 const tenantId=tenantFrom(request); const customerId=request.nextUrl.searchParams.get("customerId")||"";
 if(!tenantId||!customerId)return NextResponse.json({error:"Tenant and customer are required."},{status:400});
 const account=await getCustomerAccount(tenantId,customerId);
 if(!account)return NextResponse.json({error:"Customer could not be found."},{status:404});
 return NextResponse.json(account);
}

export async function POST(request:NextRequest){
 const tenantId=tenantFrom(request); const sid=request.cookies.get(COOKIE)?.value||"";
 const session=tenantId&&sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return NextResponse.json({error:"Employee PIN is required."},{status:401});
 if(!["ADMIN","MANAGER"].includes(session.user.role))return NextResponse.json({error:"Manager approval is required for customer account adjustments."},{status:403});
 try{
  const body=await request.json(); const customerId=String(body.customerId||""); const entryType=String(body.entryType||"") as "OWED"|"CREDIT";
  const amountCents=Math.round(Number(body.amountCents)); const reason=String(body.reason||"").trim();
  if(!customerId||!["OWED","CREDIT"].includes(entryType)||!Number.isInteger(amountCents)||amountCents<=0||!reason)return NextResponse.json({error:"Customer, account type, positive amount, and reason are required."},{status:400});
  const id=await addAccountEntry({tenantId,customerId,actorUserId:session.user.id,entryType,amountCents,reason});
  await writeAudit({tenantId,actorUserId:session.user.id,entityType:"CUSTOMER",entityId:customerId,customerId,action:"ACCOUNT_ADJUSTMENT",summary:`Adjusted customer account by $${(amountCents/100).toFixed(2)} (${entryType}).`,details:{entryType,amountCents,reason,ledgerId:id}});
  return NextResponse.json(await getCustomerAccount(tenantId,customerId));
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to adjust customer account."},{status:400});}
}
