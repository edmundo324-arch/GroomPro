import {NextRequest,NextResponse} from "next/server";
import {db} from "@/src/lib/db";
function tenant(r:NextRequest){return r.headers.get("x-tenant-id")||r.cookies.get("groompro_tenant")?.value||process.env.GROOMPRO_DEV_TENANT_ID||""}
export async function GET(r:NextRequest){
 const tenantId=tenant(r);if(!tenantId)return NextResponse.json({error:"Tenant context is required."},{status:401});
 const requestedLocation=r.nextUrl.searchParams.get("locationId")||process.env.GROOMPRO_DEV_LOCATION_ID||"";
 const locationId=requestedLocation||(await db.location.findFirst({where:{tenantId},orderBy:{createdAt:"asc"},select:{id:true}}))?.id||"";
 if(!locationId)return NextResponse.json({start:new Date(),end:new Date(),appointments:0,projectedSalesCents:0,statusCounts:{}});
 const startValue=r.nextUrl.searchParams.get("start"),endValue=r.nextUrl.searchParams.get("end");const start=startValue?new Date(startValue):new Date(),end=endValue?new Date(endValue):new Date(Date.now()+14*86400000);
 if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<=start)return NextResponse.json({error:"Invalid report range."},{status:400});
 const tickets=await db.ticket.findMany({where:{tenantId,locationId,scheduledStart:{gte:start,lt:end},status:{not:"CANCELLED"}},select:{id:true,status:true,totalCents:true,lines:{select:{totalCents:true}}}});const projectedSalesCents=tickets.reduce((sum,t)=>sum+(t.totalCents||t.lines.reduce((lineSum,l)=>lineSum+l.totalCents,0)),0);const statusCounts=tickets.reduce<Record<string,number>>((out,t)=>{out[t.status]=(out[t.status]||0)+1;return out},{});return NextResponse.json({start,end,appointments:tickets.length,projectedSalesCents,statusCounts,locationId});
}
