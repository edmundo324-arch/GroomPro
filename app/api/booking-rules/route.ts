import { NextRequest, NextResponse } from "next/server";
import { getOnlineBookingRules } from "@/src/lib/booking-rules";

function tenantFrom(request: NextRequest) { return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || ""; }

export async function GET(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const locationId = request.nextUrl.searchParams.get("locationId") || process.env.GROOMPRO_DEV_LOCATION_ID || "";
  if (!tenantId || !locationId) return NextResponse.json({ error: "Tenant and location context are required." }, { status: 401 });
  const rules = await getOnlineBookingRules(tenantId, locationId);
  return NextResponse.json({ rules });
}
