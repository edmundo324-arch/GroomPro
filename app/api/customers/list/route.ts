import {NextRequest,NextResponse} from "next/server";
import {db} from "@/src/lib/db";
export async function GET(r:NextRequest){const tenantId=r.headers.get("x-tenant-id")||process.env.GROOMPRO_DEV_TENANT_ID;if(!tenantId)return NextResponse.json({error:"Tenant required"},{status:401});const customers=await db.customer.findMany({where:{tenantId,active:true},include:{phones:{where:{isPrimary:true},select:{number:true}},pets:{where:{active:true},select:{name:true,breed:true}}},orderBy:[{lastName:"asc"},{firstName:"asc"}],take:500});return NextResponse.json({customers})}
