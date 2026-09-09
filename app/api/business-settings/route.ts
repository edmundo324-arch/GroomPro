import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";

const COOKIE = "groompro_session";
const tenantFrom = (r: NextRequest) => r.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || "";
async function sessionFor(r: NextRequest) {
  const tenantId = tenantFrom(r); const sessionId = r.cookies.get(COOKIE)?.value || "";
  return tenantId && sessionId ? getActiveEmployeeSession(tenantId, sessionId) : null;
}

export async function GET(request: NextRequest) {
  const session = await sessionFor(request);
  if (!session) return NextResponse.json({ error: "Employee session required" }, { status: 401 });
  const settings = await db.tenantSetting.findMany({ where: { tenantId: session.tenantId } });
  return NextResponse.json({ settings: Object.fromEntries(settings.map(s => [s.settingKey, s.value])) });
}

export async function PUT(request: NextRequest) {
  const session = await sessionFor(request);
  if (!session) return NextResponse.json({ error: "Employee session required" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") return NextResponse.json({ error: "Manager access required" }, { status: 403 });
  const body = await request.json();
  if (!body.key) return NextResponse.json({ error: "Setting key is required" }, { status: 400 });
  const allowed = new Set(["primaryColor", "secondaryColor", "readyColor", "vipAvailableEmoji", "vipNotAvailableEmoji", "readyMessageVipGrooming", "readyMessageVipFullWash", "readyMessageNonVip"]);
  if (!allowed.has(body.key)) return NextResponse.json({ error: "Unsupported business setting" }, { status: 400 });
  const setting = await db.tenantSetting.upsert({ where: { tenantId_settingKey: { tenantId: session.tenantId, settingKey: body.key } }, update: { value: body.value }, create: { tenantId: session.tenantId, settingKey: body.key, value: body.value } });
  return NextResponse.json({ setting });
}
