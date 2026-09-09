import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";

const SESSION_COOKIE = "groompro_session";
const tenantFrom = (r: NextRequest) => r.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || "";
async function sessionFor(r: NextRequest) {
  const tenantId = tenantFrom(r);
  const sessionId = r.cookies.get(SESSION_COOKIE)?.value || "";
  return tenantId && sessionId ? getActiveEmployeeSession(tenantId, sessionId) : null;
}

export async function GET(request: NextRequest) {
  const session = await sessionFor(request);
  if (!session) return NextResponse.json({ error: "Employee session required" }, { status: 401 });
  const catalog = await db.featureModule.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const enabled = await db.tenantFeature.findMany({ where: { tenantId: session.tenantId } });
  return NextResponse.json({ features: catalog.map(f => ({ ...f, enabled: enabled.find(e => e.featureCode === f.code)?.enabled ?? true })) });
}

export async function PUT(request: NextRequest) {
  const session = await sessionFor(request);
  if (!session) return NextResponse.json({ error: "Employee session required" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") return NextResponse.json({ error: "Manager access required" }, { status: 403 });
  const body = await request.json();
  if (!body.featureCode) return NextResponse.json({ error: "Feature is required" }, { status: 400 });
  const feature = await db.featureModule.findUnique({ where: { code: body.featureCode } });
  if (!feature || !feature.active) return NextResponse.json({ error: "Feature is not available" }, { status: 404 });
  const result = await db.tenantFeature.upsert({
    where: { tenantId_featureCode: { tenantId: session.tenantId, featureCode: body.featureCode } },
    update: { enabled: Boolean(body.enabled), config: body.config ?? undefined },
    create: { tenantId: session.tenantId, featureCode: body.featureCode, enabled: Boolean(body.enabled), config: body.config ?? undefined },
  });
  return NextResponse.json({ feature: result });
}
