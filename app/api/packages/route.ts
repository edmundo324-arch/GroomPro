import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/src/lib/db";

function tenantFrom(request: NextRequest) {
  return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID;
}

export async function GET(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  const packages = await db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT id, name, description, basePriceCents, active, createdAt, updatedAt
    FROM Package WHERE tenantId = ${tenantId} ORDER BY name ASC
  `);
  return NextResponse.json({ packages });
}

export async function POST(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const basePriceCents = Number(body.basePriceCents);
    if (!name || !Number.isInteger(basePriceCents) || basePriceCents < 0) {
      return NextResponse.json({ error: "name and a non-negative basePriceCents are required." }, { status: 400 });
    }
    const id = crypto.randomUUID();
    await db.$executeRaw(Prisma.sql`
      INSERT INTO Package (id, tenantId, name, description, basePriceCents, active)
      VALUES (${id}, ${tenantId}, ${name}, ${body.description ? String(body.description) : null}, ${basePriceCents}, true)
    `);
    return NextResponse.json({ id, name, basePriceCents }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create package." }, { status: 400 });
  }
}
