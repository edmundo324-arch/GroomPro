import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/src/lib/db";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";

const COOKIE = "groompro_session";
function tenantFrom(request: NextRequest) { return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || ""; }

async function authorize(request: NextRequest, tenantId: string) {
  const sessionId = request.cookies.get(COOKIE)?.value || "";
  const session = sessionId ? await getActiveEmployeeSession(tenantId, sessionId) : null;
  if (!session) return null;
  return ["ADMIN", "MANAGER"].includes(session.user.role) ? session.user : null;
}

export async function GET(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const customerId = request.nextUrl.searchParams.get("customerId") || "";
  if (!tenantId || !customerId) return NextResponse.json({ error: "Tenant and customer are required." }, { status: 400 });
  const rows = await db.$queryRaw<Array<{ id: string; name: string; assigned: number }>>(Prisma.sql`
    SELECT l.id, l.name, CASE WHEN cla.id IS NULL THEN 0 ELSE 1 END AS assigned
    FROM Location l
    LEFT JOIN CustomerLocationAccess cla ON cla.locationId = l.id AND cla.customerId = ${customerId} AND cla.tenantId = ${tenantId}
    WHERE l.tenantId = ${tenantId}
    ORDER BY l.name ASC
  `);
  return NextResponse.json({ locations: rows.map(r => ({ ...r, assigned: Number(r.assigned) === 1 })) });
}

export async function PUT(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  const actor = await authorize(request, tenantId);
  if (!actor) return NextResponse.json({ error: "Manager access is required." }, { status: 403 });
  try {
    const body = await request.json();
    const customerId = String(body.customerId || "");
    const locationIds: string[] = Array.isArray(body.locationIds) ? body.locationIds.map((value: unknown) => String(value)) : [];
    if (!customerId) return NextResponse.json({ error: "Customer is required." }, { status: 400 });
    const customer = await db.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true } });
    if (!customer) return NextResponse.json({ error: "Customer was not found." }, { status: 404 });
    const validLocations = await db.location.findMany({ where: { tenantId, id: { in: locationIds } }, select: { id: true } });
    if (validLocations.length !== new Set(locationIds).size) return NextResponse.json({ error: "One or more locations are invalid for this business." }, { status: 400 });
    await db.$transaction(async tx => {
      await tx.customerLocationAccess.deleteMany({ where: { tenantId, customerId } });
      if (locationIds.length) await tx.customerLocationAccess.createMany({ data: locationIds.map((locationId: string) => ({ tenantId, customerId, locationId })) });
    });
    return NextResponse.json({ ok: true, customerId, locationIds, changedBy: actor.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update customer location access." }, { status: 400 });
  }
}
