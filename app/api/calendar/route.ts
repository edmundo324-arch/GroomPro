import { NextRequest, NextResponse } from "next/server";
import { getCalendarTickets } from "@/src/lib/calendar";

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID;
  const locationId = request.nextUrl.searchParams.get("locationId") || process.env.GROOMPRO_DEV_LOCATION_ID;
  const startValue = request.nextUrl.searchParams.get("start");
  const endValue = request.nextUrl.searchParams.get("end");

  if (!tenantId || !locationId) return NextResponse.json({ error: "Tenant and location context are required." }, { status: 401 });
  if (!startValue || !endValue) return NextResponse.json({ error: "start and end are required." }, { status: 400 });

  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: "Invalid calendar range." }, { status: 400 });
  }

  const tickets = await getCalendarTickets(tenantId, locationId, start, end);
  return NextResponse.json({ tickets });
}
