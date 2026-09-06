import { NextRequest, NextResponse } from "next/server";
import { getCustomerLedgerForProfile } from "@/src/lib/customer-ledger";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";

const SESSION_COOKIE = "groompro_session";
const MANAGER_ROLES = new Set(["ADMIN", "MANAGER", "FLOOR_MANAGER"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const tenantId = request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || "";
  const { customerId } = await params;
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });

  const sessionId = request.cookies.get(SESSION_COOKIE)?.value || "";
  const session = sessionId ? await getActiveEmployeeSession(tenantId, sessionId) : null;
  if (!session) return NextResponse.json({ error: "Employee PIN is required." }, { status: 401 });
  if (!MANAGER_ROLES.has(session.user.role)) return NextResponse.json({ error: "Manager access is required to view the customer ledger." }, { status: 403 });

  const entries = await getCustomerLedgerForProfile(tenantId, customerId);
  return NextResponse.json({ entries });
}
