import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/src/lib/db";

function tenantFrom(request: NextRequest) {
  return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID;
}

const CUSTOMER_ACCESS_MODE = "CUSTOMER_ACCESS_MODE";
const allowedModes = new Set(["SHARED", "LOCATION_SCOPED", "EXPLICIT"]);

export async function GET(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });

  const rows = await db.$queryRaw<Array<{ value: unknown }>>(Prisma.sql`
    SELECT value FROM TenantSetting WHERE tenantId = ${tenantId} AND settingKey = ${CUSTOMER_ACCESS_MODE} LIMIT 1
  `);
  let mode = "SHARED";
  if (rows.length && rows[0].value) {
    const raw = typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value;
    if (typeof raw === "string" && allowedModes.has(raw)) mode = raw;
  }
  return NextResponse.json({ customerAccessMode: mode });
}

export async function PUT(request: NextRequest) {
  const tenantId = tenantFrom(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  try {
    const body = await request.json();
    const mode = String(body.customerAccessMode || "SHARED");
    if (!allowedModes.has(mode)) return NextResponse.json({ error: "Invalid customer access mode." }, { status: 400 });

    const value = JSON.stringify(mode);
    await db.$executeRaw(Prisma.sql`
      INSERT INTO TenantSetting (id, tenantId, settingKey, value)
      VALUES (${crypto.randomUUID()}, ${tenantId}, ${CUSTOMER_ACCESS_MODE}, ${value})
      ON DUPLICATE KEY UPDATE value = VALUES(value)
    `);
    return NextResponse.json({ ok: true, customerAccessMode: mode });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save tenant settings." }, { status: 400 });
  }
}
