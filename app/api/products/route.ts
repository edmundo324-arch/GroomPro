import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";

function tenantFrom(request: NextRequest) { return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || ""; }

export async function GET(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  const products = await db.product.findMany({ where: { tenantId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true, priceCents: true, quantity: true } });
  return NextResponse.json({ products });
}
