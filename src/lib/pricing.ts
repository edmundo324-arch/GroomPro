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

/**
 * Applies a percentage change to a price in cents.
 * 10 means +10%; -10 means -10%.
 */
export function applyPercent(priceCents: number, percent: number): number {
  return roundCents(priceCents * (1 + percent / 100));
}

/**
 * Resolves the effective price for a location without changing the business base price.
 * FOLLOW_BASE: inherits the current business price.
 * PERCENT_ADJUSTMENT: follows future base-price changes automatically.
 * FIXED: remains independent until explicitly changed.
 */
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

/**
 * Bulk price increase used by management for all or selected packages/services.
 * Existing location rules are intentionally not changed here: locations that follow
 * the base or use a percentage adjustment automatically reflect the new base, while
 * fixed-price locations remain independent.
 */
export function bulkIncreasePrices(
  pricesCents: number[],
  percent: number,
): number[] {
  return pricesCents.map((price) => applyPercent(price, percent));
}

export interface PackagePriceChange {
  id: string;
  oldPriceCents: number;
  newPriceCents: number;
}

/**
 * Produces a reviewable change set before a bulk increase is committed.
 * The caller can use this for confirmation, audit logging, and selective exclusions.
 */
export function buildBulkPriceChangeSet(
  prices: Array<{ id: string; priceCents: number }>,
  percent: number,
  excludedIds: string[] = [],
): PackagePriceChange[] {
  const excluded = new Set(excludedIds);

  return prices
    .filter((item) => !excluded.has(item.id))
    .map((item) => ({
      id: item.id,
      oldPriceCents: item.priceCents,
      newPriceCents: applyPercent(item.priceCents, percent),
    }));
}
