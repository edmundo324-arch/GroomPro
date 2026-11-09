import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import {businessCookie,businessId,businessPrefix,contextCookieOptions,sessionCookie} from '@/src/lib/business-context';
import {endEmployeeSession} from '@/src/lib/employee-session';
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const setupSecretConfigured = Boolean(process.env.GROOMPRO_SETUP_SECRET && process.env.GROOMPRO_SETUP_SECRET !== "replace-with-a-long-random-secret");
    const explicit = request.headers.get("x-tenant-id") || request.cookies.get("groompro_tenant")?.value || process.env.GROOMPRO_DEV_TENANT_ID;
    const tenants = await db.tenant.findMany({where:{NOT:{id:{startsWith:businessPrefix}}},select:{id:true,name:true},take:2});
    if (!tenants.length && !explicit && !await db.tenant.count()) return NextResponse.json({setupRequired:true,setupSecretConfigured},{headers});
    let tenant = explicit ? await db.tenant.findUnique({where:{id:explicit},select:{id:true,name:true}}) : null;
    // A single-business installation can restore its cookie on a new browser.
    // Multiple businesses require explicit context; never select the first.
    if (!tenant && tenants.length === 1) tenant = tenants[0];
    if (!tenant) return NextResponse.json({error:"Select the business for this installation before opening GroomPro.",setupRequired:false,setupSecretConfigured},{status:409,headers});
    const response = NextResponse.json({setupRequired:false,setupSecretConfigured,tenant},{headers});
    response.cookies.set(businessCookie,tenant.id,{...contextCookieOptions(),maxAge:60*60*24*30});
    return response;
  } catch {
    return NextResponse.json({error:"GroomPro could not connect to its business database. Check the deployment logs."},{status:503,headers});
  }
}

export async function POST(request:NextRequest){
  const tenantId=request.cookies.get(businessCookie)?.value;
  if(!businessId(tenantId))return NextResponse.json({error:'No pilot business is open.'},{status:400});
  const sessionId=request.cookies.get(sessionCookie)?.value;
  if(sessionId)await endEmployeeSession(tenantId!,sessionId);
  const response=NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  for(const key of [businessCookie,sessionCookie])response.cookies.set(key,'',{...contextCookieOptions(),maxAge:0});
  return response;
}
