import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";

function tenantFrom(request: NextRequest) {
  return request.headers.get("x-tenant-id") || request.cookies.get("groompro_tenant")?.value || process.env.GROOMPRO_DEV_TENANT_ID || null;
}

const DEFAULT_ASSETS = [
  ["Grooming", "GROOMING", "08:30", "14:00"],
  ["Full Wash", "FULL_WASH", "09:30", "15:00"],
  ["Self Service", "SELFSERVICE", "11:30", "16:30"],
  ["Nail Grinding", "NAIL_GRINDING", "13:30", "16:30"],
  ["VIP Grooming", "VIP_GROOMING", "08:30", "14:00"],
  ["VIP Full Wash", "VIP_FULL_WASH", "08:30", "15:00"],
  ["VIP Brush-out-Session", "VIP_BRUSH_OUT", "09:30", "15:00"],
  ["VIP Self Service", "VIP_SELFSERVICE", "11:30", "16:30"],
];

export async function GET(request: NextRequest) {
  const startValue = request.nextUrl.searchParams.get("start");
  const endValue = request.nextUrl.searchParams.get("end");
  if (!startValue || !endValue) return NextResponse.json({ error: "start and end are required." }, { status: 400 });
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: "Invalid calendar range." }, { status: 400 });
  }

  let tenantId = tenantFrom(request);
  let locationId = request.nextUrl.searchParams.get("locationId") || process.env.GROOMPRO_DEV_LOCATION_ID || null;
  let employees: Array<{ id: string; firstName: string; lastName: string; role: string; active: boolean }> = [];
  let tickets: unknown[] = [];
  let assets: Array<{ id: string; name: string; category: string; active: boolean; startTime: string; endTime: string }> = [];
  const warnings: string[] = [];

  try {
    if (!tenantId) tenantId = (await db.tenant.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } }))?.id || null;
    if (tenantId && !locationId) locationId = (await db.location.findFirst({ where: { tenantId }, orderBy: { createdAt: "asc" }, select: { id: true } }))?.id || null;
  } catch (error) {
    console.error("Calendar tenant/location lookup failed", error);
    warnings.push("Database tenant setup is incomplete.");
  }

  if (tenantId && locationId) {
    try {
      employees = await db.user.findMany({
        where: { tenantId, locationId },
        select: { id: true, firstName: true, lastName: true, role: true, active: true },
        orderBy: [{ active: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
      });
    } catch (error) {
      console.error("Calendar employee load failed", error);
      warnings.push("Employee data is not available yet.");
    }

    try {
      tickets = await db.ticket.findMany({
        where: { tenantId, locationId, scheduledStart: { gte: start, lt: end }, status: { not: "CANCELLED" } },
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, email: true, phones: { select: { number: true, normalized: true, label: true, isPrimary: true } } } },
          pets: { include: { pet: { select: { id: true, name: true, breed: true } } } },
          lines: { select: { id: true, lineType: true, description: true, totalCents: true } },
          assignments: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } },
        },
        orderBy: { scheduledStart: "asc" },
      });
    } catch (error) {
      console.error("Calendar ticket load failed", error);
      warnings.push("Appointment data is not available yet.");
    }

    try {
      const dayOfWeek = start.getDay();
      assets = await db.$queryRaw<Array<{ id: string; name: string; category: string; active: number; startTime: string; endTime: string }>>`
        SELECT a.id, a.name, a.category, a.active, s.startTime, s.endTime
        FROM BookingAsset a
        LEFT JOIN BookingAssetSchedule s ON s.assetId=a.id AND s.dayOfWeek=${dayOfWeek} AND s.active=1
        WHERE a.tenantId=${tenantId} AND a.locationId=${locationId} AND a.active=1
        ORDER BY a.category, a.name`;
      assets = assets.map((a) => ({ ...a, active: Boolean(a.active), startTime: a.startTime || "", endTime: a.endTime || "" }));
    } catch (error) {
      console.error("Calendar asset load failed", error);
      warnings.push("Configured booking assets are not available yet; showing defaults.");
    }
  }

  if (!assets.length) {
    assets = DEFAULT_ASSETS.map(([name, category, startTime, endTime], index) => ({
      id: `default-asset-${index + 1}`,
      name,
      category,
      active: true,
      startTime,
      endTime,
    }));
  }

  return NextResponse.json({ tickets, employees, assets, tenantId, locationId, ready: true, warnings });
}
