import { NextRequest, NextResponse } from "next/server";
import { searchCustomers } from "@/src/lib/customer";

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID;
  const query = request.nextUrl.searchParams.get("q") || "";

  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  if (query.trim().length < 2) return NextResponse.json({ customers: [] });

  const customers = await searchCustomers(tenantId, query);
  return NextResponse.json({ customers });
}
