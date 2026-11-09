import { NextRequest } from "next/server";
import { db } from "./db";
import {businessId} from './business-context';
export async function requestLocation(request: NextRequest, tenantId: string) {
 if (!tenantId) return "";
 const explicit=request.nextUrl.searchParams.get("locationId")||(!businessId(tenantId)?process.env.GROOMPRO_DEV_LOCATION_ID:undefined);
 if(explicit)return(await db.location.findFirst({where:{id:explicit,tenantId},select:{id:true}}))?.id||"";
 const locations=await db.location.findMany({where:{tenantId},select:{id:true},take:2});
 return locations.length===1?locations[0].id:"";
}

