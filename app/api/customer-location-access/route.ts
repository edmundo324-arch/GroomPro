import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/src/lib/db";

function tenantFrom(request: NextRequest) {
  return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID;
}

export async function GET(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  const customerId = request.nextUrl.searchParams.get("customerId");
  if (!customerId) return NextResponse.json({ error: "customerId is required." }, { status: 400 });

  const rows = await db.$queryRaw<Array<{ id: string; locationId: string; locationName: string }>>(Prisma.sql`
    SELECT cla.id, cla.locationId, l.name AS locationName
    FROM CustomerLocationAccess cla
    INNER JOIN Location l ON l.id = cla.locationId AND l.tenantId = ${tenantId}
    WHERE cla.customerId = ${customerId} AND cla.tenantId = ${tenantId}
    ORDER BY l.name ASC
  `);
  return NextResponse.json({ locations: rows });
}

export async function PUT(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  try {
    const body = await request.json();
    const customerId = String(body.customerId || "");
    const locationIds = Array.isArray(body.locationIds) ? body.locationIds.map(String) : [];
    if (!customerId) return NextResponse.json({ error: "customerId is required." }, { status: 400 });

    await db.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM CustomerLocationAccess WHERE tenantId = ${tenantId} AND customerId = ${customerId}
      `);
      for (const locationId of [...new Set(locationIds)]) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO CustomerLocationAccess (id, tenantId, customerId, locationId)
          SELECT ${crypto.randomUUID()}, ${tenantId}, ${customerId}, ${locationId}
          WHERE EXISTS (SELECT 1 FROM Customer WHERE id = ${customerId} AND tenantId = ${tenantId})
            AND EXISTS (SELECT 1 FROM Location WHERE id = ${locationId} AND tenantId = ${tenantId})
        `);
      }
    });
    return NextResponse.json({ ok: true, locationIds: [...new Set(locationIds)] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save customer location access." }, { status: 400 });
  }
}
