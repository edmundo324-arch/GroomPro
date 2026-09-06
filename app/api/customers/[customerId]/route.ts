import { NextRequest, NextResponse } from "next/server";
import { getCustomerProfile } from "@/src/lib/customer";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const tenantId = request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID;
  const { customerId } = await params;

  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });

  const customer = await getCustomerProfile(tenantId, customerId);
  if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

  return NextResponse.json({ customer });
}
