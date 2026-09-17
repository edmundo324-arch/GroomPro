import {NextRequest,NextResponse} from "next/server";
import {db} from "@/src/lib/db";
import {requestLocation} from "@/src/lib/request-location";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const start=new Date(request.nextUrl.searchParams.get("start")||""),end=new Date(request.nextUrl.searchParams.get("end")||"");
 if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start||+end-+start>32*86400000)return NextResponse.json({error:"A valid calendar range of up to 31 days is required."},{status:400});
 const tenantId=request.headers.get("x-tenant-id")||request.cookies.get("groompro_tenant")?.value||process.env.GROOMPRO_DEV_TENANT_ID||"";
 if(!tenantId)return NextResponse.json({error:"Business context is required."},{status:401});
 try{
 const locationId=await requestLocation(request,tenantId);
 if(!locationId)return NextResponse.json({error:"Select a location for this calendar."},{status:400});
 const[employees,tickets,assets,employeeSchedules,assetSchedules]=await Promise.all([
 db.user.findMany({where:{tenantId,locationId},select:{id:true,firstName:true,lastName:true,role:true,active:true},orderBy:[{lastName:"asc"},{firstName:"asc"}]}),
 db.ticket.findMany({where:{tenantId,locationId,scheduledStart:{gte:start,lt:end},status:{not:"CANCELLED"}},include:{customer:{select:{firstName:true,lastName:true}},pets:{include:{pet:{select:{name:true}}}},lines:{select:{description:true},orderBy:{sortOrder:"asc"}},assignments:{include:{user:{select:{id:true,firstName:true,lastName:true}}}}},orderBy:{scheduledStart:"asc"}}),
 db.$queryRaw<any[]>`SELECT id,name,category,active FROM BookingAsset WHERE tenantId=${tenantId} AND locationId=${locationId} AND active=1 ORDER BY category,name`,
 db.$queryRaw<any[]>`SELECT s.userId,s.dayOfWeek,s.startTime,s.endTime FROM EmployeeSchedule s JOIN User u ON u.id=s.userId WHERE s.tenantId=${tenantId} AND u.locationId=${locationId} AND s.active=1`,
 db.$queryRaw<any[]>`SELECT s.assetId,s.dayOfWeek,s.startTime,s.endTime FROM BookingAssetSchedule s JOIN BookingAsset a ON a.id=s.assetId WHERE a.tenantId=${tenantId} AND a.locationId=${locationId} AND s.active=1`
 ]);
 return NextResponse.json({employees,tickets,assets,employeeSchedules,assetSchedules,locationId},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("Calendar load failed",error);return NextResponse.json({error:"Calendar could not load. Retry to see your appointments."},{status:503})}
}

