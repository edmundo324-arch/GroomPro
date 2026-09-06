import { NextRequest, NextResponse } from "next/server";
import { getCustomerLedgerForProfile } from "@/src/lib/customer-ledger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const tenantId = request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID;
  const { customerId } = await params;

  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });

  const entries = await getCustomerLedgerForProfile(tenantId, customerId);
  return NextResponse.json({ entries });
}
