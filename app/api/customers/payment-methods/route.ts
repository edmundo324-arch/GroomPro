import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/src/lib/db";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";

const COOKIE="groompro_session";
const tenantFrom=(r:NextRequest)=>r.headers.get("x-tenant-id")||process.env.GROOMPRO_DEV_TENANT_ID||"";

export async function GET(request:NextRequest){
 const tenantId=tenantFrom(request);const customerId=request.nextUrl.searchParams.get("customerId")||"";
 if(!tenantId||!customerId)return NextResponse.json({error:"Tenant and customer are required."},{status:400});
 const methods=await db.$queryRaw<any[]>`SELECT id,provider,brand,last4,expMonth,expYear,isDefault,active,createdAt FROM CustomerPaymentMethod WHERE tenantId=${tenantId} AND customerId=${customerId} AND active=true ORDER BY isDefault DESC,createdAt DESC`;
 return NextResponse.json({paymentMethods:methods});
}

export async function POST(request:NextRequest){
 const tenantId=tenantFrom(request);const sid=request.cookies.get(COOKIE)?.value||"";const session=tenantId&&sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return NextResponse.json({error:"Employee PIN is required."},{status:401});
 try{
  const body=await request.json();const customerId=String(body.customerId||"");const provider=String(body.provider||"CLOVER");const providerPaymentMethodId=String(body.providerPaymentMethodId||"").trim();
  if(!customerId||!providerPaymentMethodId)return NextResponse.json({error:"A tokenized payment method is required. Raw card numbers are never stored by GroomPro."},{status:400});
  const id=randomUUID();
  await db.$transaction(async tx=>{
   if(body.isDefault!==false)await tx.$executeRaw`UPDATE CustomerPaymentMethod SET isDefault=false WHERE tenantId=${tenantId} AND customerId=${customerId} AND active=true`;
   await tx.$executeRaw`INSERT INTO CustomerPaymentMethod (id,tenantId,customerId,provider,providerCustomerId,providerPaymentMethodId,brand,last4,expMonth,expYear,isDefault,active) VALUES (${id},${tenantId},${customerId},${provider},${body.providerCustomerId||null},${providerPaymentMethodId},${body.brand||null},${body.last4||null},${body.expMonth==null?null:Number(body.expMonth)},${body.expYear==null?null:Number(body.expYear)},${body.isDefault!==false},true)`;
  });
  return NextResponse.json({id});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to save payment method."},{status:400});}
}

export async function DELETE(request:NextRequest){
 const tenantId=tenantFrom(request);const sid=request.cookies.get(COOKIE)?.value||"";const session=tenantId&&sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return NextResponse.json({error:"Employee PIN is required."},{status:401});
 const id=request.nextUrl.searchParams.get("id")||"";if(!id)return NextResponse.json({error:"Payment method is required."},{status:400});
 await db.$executeRaw`UPDATE CustomerPaymentMethod SET active=false,isDefault=false WHERE id=${id} AND tenantId=${tenantId}`;
 return NextResponse.json({success:true});
}
