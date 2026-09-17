import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const setupSecretConfigured = Boolean(process.env.GROOMPRO_SETUP_SECRET && process.env.GROOMPRO_SETUP_SECRET !== "replace-with-a-long-random-secret");
    const explicit = request.headers.get("x-tenant-id") || request.cookies.get("groompro_tenant")?.value || process.env.GROOMPRO_DEV_TENANT_ID;
    const tenants = await db.tenant.findMany({ select: { id:true, name:true }, take:2 });
    if (!tenants.length) return NextResponse.json({setupRequired:true,setupSecretConfigured},{headers});
    let tenant = explicit ? await db.tenant.findUnique({where:{id:explicit},select:{id:true,name:true}}) : null;
    // A single-business installation can restore its cookie on a new browser.
    // Multiple businesses require explicit context; never select the first.
    if (!tenant && tenants.length === 1) tenant = tenants[0];
    if (!tenant) return NextResponse.json({error:"Select the business for this installation before opening GroomPro.",setupRequired:false,setupSecretConfigured},{status:409,headers});
    const response = NextResponse.json({setupRequired:false,setupSecretConfigured,tenant},{headers});
    response.cookies.set("groompro_tenant",tenant.id,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV === "production",path:"/",maxAge:60*60*24*30});
    return response;
  } catch {
    return NextResponse.json({error:"GroomPro could not connect to its business database. Check the deployment logs."},{status:503,headers});
  }
}
