import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/src/lib/db";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";
import { redeemRewards } from "@/src/lib/customer-account";
import { writeAudit } from "@/src/lib/audit";

const COOKIE="groompro_session";
const tenantFrom=(r:NextRequest)=>r.headers.get("x-tenant-id")||process.env.GROOMPRO_DEV_TENANT_ID||"";
const TYPES=["FREE_SERVICE","DISCOUNT_DOLLARS","FREE_DAYCARE","PRODUCT","OTHER"];

export async function GET(request:NextRequest){
 const tenantId=tenantFrom(request); if(!tenantId)return NextResponse.json({error:"Tenant context is required."},{status:401});
 const customerId=request.nextUrl.searchParams.get("customerId");
 const catalog=await db.$queryRaw<any[]>`SELECT id,name,description,rewardType,pointsCost,discountCents,serviceId,productId,secret,active,createdAt,updatedAt FROM RewardCatalogItem WHERE tenantId=${tenantId} AND active=true ORDER BY pointsCost ASC,name ASC`;
 if(!customerId)return NextResponse.json({catalog});
 const rows=await db.$queryRaw<any[]>`SELECT loyaltyPoints FROM Customer WHERE id=${customerId} AND tenantId=${tenantId} LIMIT 1`;
 if(!rows.length)return NextResponse.json({error:"Customer could not be found."},{status:404});
 return NextResponse.json({points:Number(rows[0].loyaltyPoints||0),catalog});
}

export async function POST(request:NextRequest){
 const tenantId=tenantFrom(request); const sid=request.cookies.get(COOKIE)?.value||"";
 const session=tenantId&&sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return NextResponse.json({error:"Employee PIN is required."},{status:401});
 try{
  const body=await request.json(); const action=String(body.action||"CREATE");
  if(action==="REDEEM"){
   const customerId=String(body.customerId||""); const rewardId=String(body.rewardId||"");
   const reward=await db.$queryRaw<any[]>`SELECT id,name,pointsCost,active FROM RewardCatalogItem WHERE id=${rewardId} AND tenantId=${tenantId} LIMIT 1`;
   if(!reward.length||!reward[0].active)return NextResponse.json({error:"Reward could not be found."},{status:404});
   const ledgerId=await redeemRewards({tenantId,customerId,ticketId:body.ticketId||null,actorUserId:session.user.id,points:Number(reward[0].pointsCost),rewardId,reason:String(body.reason||`Redeemed ${reward[0].name}`)});
   await writeAudit({tenantId,actorUserId:session.user.id,entityType:"CUSTOMER",entityId:customerId,customerId,action:"REWARD_REDEMPTION",summary:`Redeemed reward: ${reward[0].name}.`,details:{rewardId,points:reward[0].pointsCost,ledgerId,ticketId:body.ticketId||null}});
   return NextResponse.json({success:true,ledgerId});
  }
  if(!["ADMIN","MANAGER"].includes(session.user.role))return NextResponse.json({error:"Manager approval is required to configure rewards."},{status:403});
  const name=String(body.name||"").trim(); const pointsCost=Math.round(Number(body.pointsCost)); const rewardType=String(body.rewardType||"");
  if(!name||!Number.isInteger(pointsCost)||pointsCost<=0||!TYPES.includes(rewardType))return NextResponse.json({error:"Name, positive point cost, and valid reward type are required."},{status:400});
  const id=randomUUID();
  await db.$executeRaw`
    INSERT INTO RewardCatalogItem (id,tenantId,name,description,rewardType,pointsCost,discountCents,serviceId,productId,secret,active)
    VALUES (${id},${tenantId},${name},${String(body.description||"")||null},${rewardType},${pointsCost},${body.discountCents==null?null:Math.round(Number(body.discountCents))},${body.serviceId||null},${body.productId||null},${body.secret!==false},true)`;
  return NextResponse.json({id});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to process reward."},{status:400});}
}
