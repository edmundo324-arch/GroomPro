import { NextRequest } from "next/server";
import { db } from "./db";
export async function requestLocation(request: NextRequest, tenantId: string) {
 if (!tenantId) return "";
 const explicit=request.nextUrl.searchParams.get("locationId")||process.env.GROOMPRO_DEV_LOCATION_ID;
 if(explicit)return(await db.location.findFirst({where:{id:explicit,tenantId},select:{id:true}}))?.id||"";
 const locations=await db.location.findMany({where:{tenantId},select:{id:true},take:2});
 return locations.length===1?locations[0].id:"";
}

