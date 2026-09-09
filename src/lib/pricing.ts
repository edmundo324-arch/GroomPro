import { Prisma } from "@prisma/client";
import { db } from "@/src/lib/db";

export type LocationPriceMode =
  | "FOLLOW_BASE"
  | "PERCENT_ADJUSTMENT"
  | "FIXED";

export interface LocationPriceRule {
  mode: LocationPriceMode;
  adjustmentPct?: number | null;
  priceCents?: number | null;
}

export function roundCents(value: number): number {
  return Math.round(value);
}

/** 10 means +10%; -10 means -10%. */
export function applyPercent(priceCents: number, percent: number): number {
  return roundCents(priceCents * (1 + percent / 100));
}

export function resolveLocationPrice(
  basePriceCents: number,
  rule?: LocationPriceRule | null,
): number {
  if (!rule || rule.mode === "FOLLOW_BASE") return basePriceCents;
  if (rule.mode === "PERCENT_ADJUSTMENT") {
    return applyPercent(basePriceCents, Number(rule.adjustmentPct ?? 0));
  }
  return Number(rule.priceCents ?? basePriceCents);
}

export function bulkIncreasePrices(pricesCents: number[], percent: number): number[] {
  return pricesCents.map((price) => applyPercent(price, percent));
}

export interface PackagePriceChange {
  id: string;
  oldPriceCents: number;
  newPriceCents: number;
}

export function buildBulkPriceChangeSet(
  prices: Array<{ id: string; priceCents: number }>,
  percent: number,
  excludedIds: string[] = [],
): PackagePriceChange[] {
  const excluded = new Set(excludedIds);
  return prices.filter((item) => !excluded.has(item.id)).map((item) => ({
    id: item.id,
    oldPriceCents: item.priceCents,
    newPriceCents: applyPercent(item.priceCents, percent),
  }));
}

export type PriceResult = {
  basePriceCents: number;
  adjustmentPct: number;
  overrideCents: number | null;
  finalPriceCents: number;
};

/** Effective service price: exact location override -> percentage adjustment -> base price. */
export async function getServicePrice(
  tenantId: string,
  locationId: string,
  serviceId: string,
): Promise<PriceResult | null> {
  const rows = await db.$queryRaw<Array<{
    basePriceCents: number;
    priceAdjustmentPct: Prisma.Decimal | number | null;
    priceOverrideCents: number | null;
  }>>(Prisma.sql`
    SELECT s.priceCents AS basePriceCents,
           COALESCE(lsp.priceAdjustmentPct, 0) AS priceAdjustmentPct,
           lsp.priceOverrideCents
    FROM Service s
    LEFT JOIN LocationServicePricing lsp
      ON lsp.serviceId = s.id
      AND lsp.locationId = ${locationId}
      AND lsp.tenantId = ${tenantId}
      AND lsp.active = true
    WHERE s.id = ${serviceId} AND s.tenantId = ${tenantId} AND s.active = true
    LIMIT 1
  `);
  if (!rows.length) return null;
  const row = rows[0];
  const adjustmentPct = Number(row.priceAdjustmentPct ?? 0);
  return {
    basePriceCents: row.basePriceCents,
    adjustmentPct,
    overrideCents: row.priceOverrideCents,
    finalPriceCents: row.priceOverrideCents != null
      ? row.priceOverrideCents
      : applyPercent(row.basePriceCents, adjustmentPct),
  };
}

/** Effective package price using the same precedence as services. */
export async function getPackagePrice(
  tenantId: string,
  locationId: string,
  packageId: string,
): Promise<PriceResult | null> {
  const rows = await db.$queryRaw<Array<{
    basePriceCents: number;
    priceAdjustmentPct: Prisma.Decimal | number | null;
    priceOverrideCents: number | null;
  }>>(Prisma.sql`
    SELECT p.basePriceCents,
           COALESCE(lpp.priceAdjustmentPct, 0) AS priceAdjustmentPct,
           lpp.priceOverrideCents
    FROM Package p
    LEFT JOIN LocationPackagePricing lpp
      ON lpp.packageId = p.id
      AND lpp.locationId = ${locationId}
      AND lpp.tenantId = ${tenantId}
      AND lpp.active = true
    WHERE p.id = ${packageId} AND p.tenantId = ${tenantId} AND p.active = true
    LIMIT 1
  `);
  if (!rows.length) return null;
  const row = rows[0];
  const adjustmentPct = Number(row.priceAdjustmentPct ?? 0);
  return {
    basePriceCents: row.basePriceCents,
    adjustmentPct,
    overrideCents: row.priceOverrideCents,
    finalPriceCents: row.priceOverrideCents != null
      ? row.priceOverrideCents
      : applyPercent(row.basePriceCents, adjustmentPct),
  };
}

export type BulkPriceChange = {
  entityType: "SERVICE" | "PACKAGE";
  adjustmentPct: number;
  entityIds?: string[];
  reason?: string;
  actorUserId?: string;
};

/**
 * Updates business base prices atomically. Existing location adjustments are preserved,
 * so percentage-based locations automatically follow the new base and fixed overrides remain fixed.
 */
export async function bulkIncreaseBasePrices(tenantId: string, change: BulkPriceChange) {
  if (!Number.isFinite(change.adjustmentPct) || change.adjustmentPct <= -100) {
    throw new Error("A valid percentage greater than -100 is required.");
  }

  const table = change.entityType === "SERVICE" ? "Service" : "Package";
  const idFilter = change.entityIds?.length
    ? Prisma.sql`AND id IN (${Prisma.join(change.entityIds)})`
    : Prisma.empty;

  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; priceCents: number }>>(
      Prisma.sql`SELECT id, priceCents FROM ${Prisma.raw(table)} WHERE tenantId = ${tenantId} AND active = true ${idFilter}`,
    );

    const batchId = crypto.randomUUID();
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO PricingChangeBatch (id, tenantId, actorUserId, changeType, adjustmentPct, reason)
      VALUES (${batchId}, ${tenantId}, ${change.actorUserId ?? null}, 'BASE_PRICE_BULK_ADJUSTMENT', ${change.adjustmentPct}, ${change.reason ?? null})
    `);

    for (const row of rows) {
      const newPrice = applyPercent(row.priceCents, change.adjustmentPct);
      await tx.$executeRaw(Prisma.sql`
        UPDATE ${Prisma.raw(table)} SET priceCents = ${newPrice}
        WHERE id = ${row.id} AND tenantId = ${tenantId}
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO PricingChangeItem (id, batchId, entityType, entityId, oldBasePriceCents, newBasePriceCents)
        VALUES (${crypto.randomUUID()}, ${batchId}, ${change.entityType}, ${row.id}, ${row.priceCents}, ${newPrice})
      `);
    }

    return { batchId, changedCount: rows.length };
  });
}
