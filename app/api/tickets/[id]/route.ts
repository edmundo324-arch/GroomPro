import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";

const tenantFrom=(r:NextRequest)=>r.headers.get("x-tenant-id")||process.env.GROOMPRO_DEV_TENANT_ID||"";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const tenantId=tenantFrom(request);const {id}=await params;
 if(!tenantId)return NextResponse.json({error:"Tenant context is required."},{status:401});
 const ticket=await db.ticket.findFirst({where:{id,tenantId},include:{customer:{include:{phones:true}},location:true,pets:{include:{pet:true}},lines:{include:{pet:true,service:true,product:true,assignedUser:true}},assignments:{include:{user:true}},payments:true,scheduleHistory:{include:{actor:true},orderBy:{changedAt:"asc"}}}});
 if(!ticket)return NextResponse.json({error:"Ticket could not be found."},{status:404});
 return NextResponse.json({ticket});
}
