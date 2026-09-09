import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/src/lib/db";

function tenantFrom(request: NextRequest) {
  return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID;
}

function parseMode(body: Record<string, unknown>) {
  if (body.mode === "FIXED") return "FIXED";
  if (body.mode === "PERCENT_ADJUSTMENT") return "PERCENT_ADJUSTMENT";
  return "FOLLOW_BASE";
}

export async function PUT(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });

  try {
    const body = await request.json() as Record<string, unknown>;
    const locationId = String(body.locationId || "");
    const entityId = String(body.entityId || "");
    const entityType = body.entityType === "PACKAGE" ? "PACKAGE" : "SERVICE";
    const mode = parseMode(body);
    const adjustmentPct = Number(body.adjustmentPct ?? 0);
    const priceOverrideCents = body.priceOverrideCents == null ? null : Number(body.priceOverrideCents);

    if (!locationId || !entityId) return NextResponse.json({ error: "locationId and entityId are required." }, { status: 400 });
    if (!Number.isFinite(adjustmentPct) || adjustmentPct <= -100) {
      return NextResponse.json({ error: "A valid adjustment percentage greater than -100 is required." }, { status: 400 });
    }
    if (mode === "FIXED" && (!Number.isInteger(priceOverrideCents) || priceOverrideCents < 0)) {
      return NextResponse.json({ error: "A non-negative fixed price in cents is required." }, { status: 400 });
    }

    const validLocation = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM Location WHERE id = ${locationId} AND tenantId = ${tenantId} LIMIT 1
    `);
    if (!validLocation.length) return NextResponse.json({ error: "Location not found." }, { status: 404 });

    if (entityType === "PACKAGE") {
      const valid = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM Package WHERE id = ${entityId} AND tenantId = ${tenantId} AND active = true LIMIT 1
      `);
      if (!valid.length) return NextResponse.json({ error: "Package not found." }, { status: 404 });
      await db.$executeRaw(Prisma.sql`
        INSERT INTO LocationPackagePricing
          (id, tenantId, locationId, packageId, priceAdjustmentPct, priceOverrideCents, active)
        VALUES
          (${crypto.randomUUID()}, ${tenantId}, ${locationId}, ${entityId}, ${mode === "PERCENT_ADJUSTMENT" ? adjustmentPct : 0}, ${mode === "FIXED" ? priceOverrideCents : null}, true)
        ON DUPLICATE KEY UPDATE
          priceAdjustmentPct = VALUES(priceAdjustmentPct),
          priceOverrideCents = VALUES(priceOverrideCents),
          active = true
      `);
    } else {
      const valid = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM Service WHERE id = ${entityId} AND tenantId = ${tenantId} AND active = true LIMIT 1
      `);
      if (!valid.length) return NextResponse.json({ error: "Service not found." }, { status: 404 });
      await db.$executeRaw(Prisma.sql`
        INSERT INTO LocationServicePricing
          (id, tenantId, locationId, serviceId, priceAdjustmentPct, priceOverrideCents, active)
        VALUES
          (${crypto.randomUUID()}, ${tenantId}, ${locationId}, ${entityId}, ${mode === "PERCENT_ADJUSTMENT" ? adjustmentPct : 0}, ${mode === "FIXED" ? priceOverrideCents : null}, true)
        ON DUPLICATE KEY UPDATE
          priceAdjustmentPct = VALUES(priceAdjustmentPct),
          priceOverrideCents = VALUES(priceOverrideCents),
          active = true
      `);
    }

    return NextResponse.json({ ok: true, entityType, entityId, locationId, mode });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save location pricing." }, { status: 400 });
  }
}
