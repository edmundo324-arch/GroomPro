import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/src/lib/db";

function tenantIdFrom(request: NextRequest) {
  return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || null;
}

export async function GET(request: NextRequest) {
  const tenantId = tenantIdFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  const locationId = request.nextUrl.searchParams.get("locationId");
  const assets = await db.$queryRaw<Array<Record<string, unknown>>>`
    SELECT a.id, a.tenantId, a.locationId, a.name, a.category, a.onlineBookingRecipient, a.active,
           s.id AS scheduleId, s.dayOfWeek, s.startTime, s.endTime, s.active AS scheduleActive
    FROM BookingAsset a
    LEFT JOIN BookingAssetSchedule s ON s.assetId = a.id
    WHERE a.tenantId = ${tenantId}
      AND (${locationId} IS NULL OR a.locationId = ${locationId})
    ORDER BY a.category, a.name, s.dayOfWeek, s.startTime
  `;

  const grouped = new Map<string, Record<string, unknown> & { schedules: unknown[] }>();
  for (const row of assets) {
    const id = String(row.id);
    let asset = grouped.get(id);
    if (!asset) {
      asset = {
        id: row.id,
        tenantId: row.tenantId,
        locationId: row.locationId,
        name: row.name,
        category: row.category,
        onlineBookingRecipient: Boolean(row.onlineBookingRecipient),
        active: Boolean(row.active),
        schedules: [],
      };
      grouped.set(id, asset);
    }
    if (row.scheduleId) {
      asset.schedules.push({
        id: row.scheduleId,
        dayOfWeek: Number(row.dayOfWeek),
        startTime: row.startTime,
        endTime: row.endTime,
        active: Boolean(row.scheduleActive),
      });
    }
  }

  return NextResponse.json({ assets: Array.from(grouped.values()) });
}

export async function POST(request: NextRequest) {
  const tenantId = tenantIdFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  const body = await request.json();
  const { locationId, name, category, onlineBookingRecipient = true, schedules = [] } = body;
  if (!locationId || !name || !category) return NextResponse.json({ error: "locationId, name, and category are required." }, { status: 400 });

  const location = await db.location.findFirst({ where: { id: locationId, tenantId } });
  if (!location) return NextResponse.json({ error: "Location not found." }, { status: 404 });

  const id = randomUUID();
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO BookingAsset (id, tenantId, locationId, name, category, onlineBookingRecipient, active)
      VALUES (${id}, ${tenantId}, ${locationId}, ${name}, ${category}, ${Boolean(onlineBookingRecipient)}, true)
    `;
    for (const schedule of schedules) {
      await tx.$executeRaw`
        INSERT INTO BookingAssetSchedule (id, assetId, dayOfWeek, startTime, endTime, active)
        VALUES (${randomUUID()}, ${id}, ${Number(schedule.dayOfWeek)}, ${String(schedule.startTime)}, ${String(schedule.endTime)}, true)
      `;
    }
  });
  return NextResponse.json({ id }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const tenantId = tenantIdFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  const body = await request.json();
  const { id, name, category, active, onlineBookingRecipient, schedules } = body;
  if (!id) return NextResponse.json({ error: "Asset id is required." }, { status: 400 });

  const existing = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM BookingAsset WHERE id = ${id} AND tenantId = ${tenantId} LIMIT 1
  `;
  if (existing.length === 0) return NextResponse.json({ error: "Asset not found." }, { status: 404 });

  await db.$transaction(async (tx) => {
    if (name !== undefined || category !== undefined || active !== undefined || onlineBookingRecipient !== undefined) {
      const current = await tx.$queryRaw<Array<{ name: string; category: string; active: number; onlineBookingRecipient: number }>>`
        SELECT name, category, active, onlineBookingRecipient FROM BookingAsset WHERE id = ${id} AND tenantId = ${tenantId} LIMIT 1
      `;
      const row = current[0];
      await tx.$executeRaw`
        UPDATE BookingAsset
        SET name = ${name ?? row.name},
            category = ${category ?? row.category},
            active = ${active === undefined ? Boolean(row.active) : Boolean(active)},
            onlineBookingRecipient = ${onlineBookingRecipient === undefined ? Boolean(row.onlineBookingRecipient) : Boolean(onlineBookingRecipient)},
            updatedAt = CURRENT_TIMESTAMP(3)
        WHERE id = ${id} AND tenantId = ${tenantId}
      `;
    }

    if (Array.isArray(schedules)) {
      await tx.$executeRaw`DELETE FROM BookingAssetSchedule WHERE assetId = ${id}`;
      for (const schedule of schedules) {
        await tx.$executeRaw`
          INSERT INTO BookingAssetSchedule (id, assetId, dayOfWeek, startTime, endTime, active)
          VALUES (${randomUUID()}, ${id}, ${Number(schedule.dayOfWeek)}, ${String(schedule.startTime)}, ${String(schedule.endTime)}, true)
        `;
      }
    }
  });

  return NextResponse.json({ ok: true });
}
