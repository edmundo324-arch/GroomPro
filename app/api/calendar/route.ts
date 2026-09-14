import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { getCalendarTickets } from "@/src/lib/calendar";

function tenantFrom(request: NextRequest) {
  return request.headers.get("x-tenant-id") || request.cookies.get("groompro_tenant")?.value || process.env.GROOMPRO_DEV_TENANT_ID || null;
}

export async function GET(request: NextRequest) {
  try {
    let tenantId = tenantFrom(request);
    let locationId = request.nextUrl.searchParams.get("locationId") || process.env.GROOMPRO_DEV_LOCATION_ID || null;
    if (!tenantId) tenantId = (await db.tenant.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } }))?.id || null;
    if (!tenantId) return NextResponse.json({ tickets: [], employees: [], assets: [], ready: false });
    if (!locationId) locationId = (await db.location.findFirst({ where: { tenantId }, orderBy: { createdAt: "asc" }, select: { id: true } }))?.id || null;
    if (!locationId) return NextResponse.json({ tickets: [], employees: [], assets: [], ready: false, tenantId });

    const startValue = request.nextUrl.searchParams.get("start");
    const endValue = request.nextUrl.searchParams.get("end");
    if (!startValue || !endValue) return NextResponse.json({ error: "start and end are required." }, { status: 400 });
    const start = new Date(startValue), end = new Date(endValue);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return NextResponse.json({ error: "Invalid calendar range." }, { status: 400 });

    const [tickets, employees, assets] = await Promise.all([
      getCalendarTickets(tenantId, locationId, start, end).catch((error) => { console.error("Calendar ticket load failed", error); return []; }),
      db.user.findMany({ where: { tenantId, locationId }, select: { id: true, firstName: true, lastName: true, role: true, active: true }, orderBy: [{ active: "desc" }, { lastName: "asc" }, { firstName: "asc" }] }).catch((error) => { console.error("Calendar employee load failed", error); return []; }),
      db.$queryRaw<Array<{ id: string; name: string; category: string; active: number }>>`SELECT id,name,category,active FROM BookingAsset WHERE tenantId=${tenantId} AND locationId=${locationId} AND active=1 ORDER BY category,name`.catch((error) => { console.error("Calendar asset load failed", error); return []; }),
    ]);
    return NextResponse.json({ tickets, employees, assets, tenantId, locationId, ready: true });
  } catch (error) {
    console.error("Calendar load failed", error);
    return NextResponse.json({ tickets: [], employees: [], assets: [], ready: false, error: "Calendar data could not be loaded." }, { status: 200 });
  }
}
