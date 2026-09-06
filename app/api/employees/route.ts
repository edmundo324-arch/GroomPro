import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID;
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  const employees = await db.user.findMany({ where: { tenantId, active: true }, select: { id: true, firstName: true, lastName: true, role: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
  return NextResponse.json({ employees });
}
