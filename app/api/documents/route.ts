import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/src/lib/db";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";
import { writeAudit } from "@/src/lib/audit";

const COOKIE="groompro_session";
const tenantFrom=(r:NextRequest)=>r.headers.get("x-tenant-id")||process.env.GROOMPRO_DEV_TENANT_ID||"";

export async function GET(request:NextRequest){
  const tenantId=tenantFrom(request); const customerId=request.nextUrl.searchParams.get("customerId"); const membershipId=request.nextUrl.searchParams.get("membershipId");
  if(!tenantId)return NextResponse.json({error:"Tenant context is required."},{status:401});
  if(customerId){const documents=await db.$queryRaw<any[]>`SELECT id,customerId,petId,membershipId,documentType,title,version,status,signedAt,signedByName,customerEmail,sentCopy,createdAt FROM SignedDocument WHERE tenantId=${tenantId} AND customerId=${customerId} ORDER BY createdAt DESC`;return NextResponse.json({documents});}
  if(membershipId){const documents=await db.$queryRaw<any[]>`SELECT id,customerId,petId,membershipId,documentType,title,version,status,signedAt,signedByName,customerEmail,sentCopy,createdAt FROM SignedDocument WHERE tenantId=${tenantId} AND membershipId=${membershipId} ORDER BY createdAt DESC`;return NextResponse.json({documents});}
  return NextResponse.json({error:"customerId or membershipId is required."},{status:400});
}

export async function POST(request:NextRequest){
  const tenantId=tenantFrom(request); const sid=request.cookies.get(COOKIE)?.value||""; const session=tenantId&&sid?await getActiveEmployeeSession(tenantId,sid):null;
  if(!session)return NextResponse.json({error:"Employee PIN is required."},{status:401});
  try{
    const b=await request.json(); const customerId=String(b.customerId||""); const petId=b.petId?String(b.petId):null; const membershipId=b.membershipId?String(b.membershipId):null; const documentType=String(b.documentType||"NEW_CUSTOMER_CONTRACT"); const title=String(b.title||"New Customer Contract"); const version=String(b.version||"1.0"); const signedByName=String(b.signedByName||""); const customerEmail=b.customerEmail?String(b.customerEmail):null; const documentContent=String(b.documentContent||""); const signatureData=b.signatureData?String(b.signatureData):null;
    if(!customerId||!documentContent||!signedByName)return NextResponse.json({error:"Customer, completed document content, and signature name are required."},{status:400});
    const customer=await db.customer.findFirst({where:{id:customerId,tenantId},select:{id:true}}); if(!customer)return NextResponse.json({error:"Customer not found."},{status:404});
    const id=randomUUID(); const now=new Date();
    await db.$executeRaw`INSERT INTO SignedDocument (id,tenantId,customerId,petId,membershipId,documentType,title,version,status,signedAt,signedByName,customerEmail,documentContent,signatureData) VALUES (${id},${tenantId},${customerId},${petId},${membershipId},${documentType},${title},${version},'SIGNED',${now},${signedByName},${customerEmail},${documentContent},${signatureData})`;
    await writeAudit({tenantId,actorUserId:session.user.id,entityType:membershipId?"MEMBERSHIP":"CUSTOMER",entityId:membershipId||customerId,customerId,action:"DOCUMENT_SIGNED",summary:`${title} signed.`,details:{documentId:id,documentType,version,signedAt:now.toISOString(),membershipId,petId}});
    return NextResponse.json({documentId:id,signedAt:now.toISOString()},{status:201});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Unable to save signed document."},{status:400});}
}
