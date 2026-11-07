import {withRequestPolicy} from '@/src/lib/request-policy';
import { NextRequest, NextResponse } from "next/server";
import { searchCustomers } from "@/src/lib/customer";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";

async function handlePolicyGET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id") || request.cookies.get("groompro_tenant")?.value || process.env.GROOMPRO_DEV_TENANT_ID;
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  const size = request.nextUrl.searchParams.get("limit");
  if (size === null && query.length < 2) return NextResponse.json({ customers: [] });
  if (size !== null) {
    if (!["50", "100", "200", "all"].includes(size)) {
      return NextResponse.json({ error: "Choose 50, 100, 200, or All customers." }, { status: 400 });
    }
    const sessionId = request.cookies.get("groompro_session")?.value;
    if (!sessionId || !await getActiveEmployeeSession(tenantId, sessionId)) {
      return NextResponse.json({ error: "Employee PIN is required." }, { status: 401 });
    }
  }
  const limit = size === "all" ? "all" : size === null ? 25 : Number(size);
  try {
    return NextResponse.json({ customers: await searchCustomers(tenantId, query, limit) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Customer search could not be completed." }, { status: 500 });
  }
}

export const GET=withRequestPolicy(handlePolicyGET, {feature:'CUSTOMERS'});
