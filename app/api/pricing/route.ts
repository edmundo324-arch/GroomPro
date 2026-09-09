import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/src/lib/db";
import { bulkIncreaseBasePrices, getPackagePrice, getServicePrice } from "@/src/lib/pricing";

function tenantFrom(request: NextRequest) {
  return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID;
}

export async function GET(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });

  const locationId = request.nextUrl.searchParams.get("locationId");
  const type = request.nextUrl.searchParams.get("type") || "SERVICE";
  const entityId = request.nextUrl.searchParams.get("entityId");

  if (locationId && entityId) {
    const price = type === "PACKAGE"
      ? await getPackagePrice(tenantId, locationId, entityId)
      : await getServicePrice(tenantId, locationId, entityId);
    return price
      ? NextResponse.json({ type, entityId, locationId, price })
      : NextResponse.json({ error: "Priceable item not found." }, { status: 404 });
  }

  if (type === "PACKAGE") {
    const rows = await db.$queryRaw<Array<{
      id: string; name: string; basePriceCents: number;
      priceAdjustmentPct: Prisma.Decimal | number | null; priceOverrideCents: number | null;
    }>>(Prisma.sql`
      SELECT p.id, p.name, p.basePriceCents,
             COALESCE(lpp.priceAdjustmentPct, 0) AS priceAdjustmentPct,
             lpp.priceOverrideCents
      FROM Package p
      LEFT JOIN LocationPackagePricing lpp
        ON lpp.packageId = p.id AND lpp.locationId = ${locationId ?? ""}
        AND lpp.tenantId = ${tenantId} AND lpp.active = true
      WHERE p.tenantId = ${tenantId} AND p.active = true
      ORDER BY p.name ASC
    `);
    return NextResponse.json({ packages: rows.map((row) => ({
      ...row,
      adjustmentPct: Number(row.priceAdjustmentPct ?? 0),
      finalPriceCents: row.priceOverrideCents != null
        ? row.priceOverrideCents
        : Math.round(row.basePriceCents * (1 + Number(row.priceAdjustmentPct ?? 0) / 100)),
    })) });
  }

  const rows = await db.$queryRaw<Array<{
    id: string; name: string; category: string | null; basePriceCents: number;
    priceAdjustmentPct: Prisma.Decimal | number | null; priceOverrideCents: number | null;
  }>>(Prisma.sql`
    SELECT s.id, s.name, s.category, s.priceCents AS basePriceCents,
           COALESCE(lsp.priceAdjustmentPct, 0) AS priceAdjustmentPct,
           lsp.priceOverrideCents
    FROM Service s
    LEFT JOIN LocationServicePricing lsp
      ON lsp.serviceId = s.id AND lsp.locationId = ${locationId ?? ""}
      AND lsp.tenantId = ${tenantId} AND lsp.active = true
    WHERE s.tenantId = ${tenantId} AND s.active = true
    ORDER BY s.category ASC, s.name ASC
  `);
  return NextResponse.json({ services: rows.map((row) => ({
    ...row,
    adjustmentPct: Number(row.priceAdjustmentPct ?? 0),
    finalPriceCents: row.priceOverrideCents != null
      ? row.priceOverrideCents
      : Math.round(row.basePriceCents * (1 + Number(row.priceAdjustmentPct ?? 0) / 100)),
  })) });
}

export async function POST(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });

  try {
    const body = await request.json();
    const result = await bulkIncreaseBasePrices(tenantId, {
      entityType: body.entityType === "PACKAGE" ? "PACKAGE" : "SERVICE",
      adjustmentPct: Number(body.adjustmentPct),
      entityIds: Array.isArray(body.entityIds) ? body.entityIds : undefined,
      reason: typeof body.reason === "string" ? body.reason : undefined,
      actorUserId: typeof body.actorUserId === "string" ? body.actorUserId : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update pricing.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
