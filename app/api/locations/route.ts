import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/src/lib/db";

function tenantFrom(request: NextRequest) {
  return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID;
}

export async function GET(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  const locations = await db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT id, name, address1, address2, city, state, postalCode, timezone, createdAt, updatedAt
    FROM Location WHERE tenantId = ${tenantId} ORDER BY name ASC
  `);
  return NextResponse.json({ locations });
}

export async function POST(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Location name is required." }, { status: 400 });
    const id = crypto.randomUUID();
    await db.$executeRaw(Prisma.sql`
      INSERT INTO Location (id, tenantId, name, address1, address2, city, state, postalCode, timezone)
      VALUES (${id}, ${tenantId}, ${name}, ${body.address1 ? String(body.address1) : null}, ${body.address2 ? String(body.address2) : null}, ${body.city ? String(body.city) : null}, ${body.state ? String(body.state) : null}, ${body.postalCode ? String(body.postalCode) : null}, ${body.timezone ? String(body.timezone) : "America/Chicago"})
    `);
    return NextResponse.json({ id, name }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create location." }, { status: 400 });
  }
}
