import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { verifyPin } from "@/src/lib/pin";
import { createDeviceId, endEmployeeSession, getActiveEmployeeSession, startEmployeeSession } from "@/src/lib/employee-session";

const SESSION_COOKIE = "groompro_session";
const DEVICE_COOKIE = "groompro_device";

function tenantFrom(request: NextRequest) {
  return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || "";
}

async function getContext(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const deviceId = request.cookies.get(DEVICE_COOKIE)?.value || createDeviceId();
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value || "";
  return { tenantId, deviceId, sessionId };
}

export async function GET(request: NextRequest) {
  const { tenantId, sessionId } = await getContext(request);
  if (!tenantId || !sessionId) return NextResponse.json({ employee: null });

  const session = await getActiveEmployeeSession(tenantId, sessionId);
  if (!session) return NextResponse.json({ employee: null });

  return NextResponse.json({ employee: { id: session.user.id, firstName: session.user.firstName, lastName: session.user.lastName, role: session.user.role } });
}

export async function POST(request: NextRequest) {
  const { tenantId, deviceId } = await getContext(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });

  let body: { pin?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const pin = String(body.pin || "");
  if (!/^\d{4,10}$/.test(pin)) return NextResponse.json({ error: "PIN must contain 4–10 digits." }, { status: 400 });

  const users = await db.user.findMany({ where: { tenantId, active: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
  const user = (await Promise.all(users.map(async (candidate) => (await verifyPin(pin, candidate.pinHash)) ? candidate : null))).find(Boolean);
  if (!user) return NextResponse.json({ error: "Employee PIN not recognized." }, { status: 401 });

  const session = await startEmployeeSession(tenantId, user.id, deviceId);
  const response = NextResponse.json({ employee: { id: user.id, firstName: user.firstName, lastName: user.lastName, role: user.role } });
  response.cookies.set(DEVICE_COOKIE, deviceId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  response.cookies.set(SESSION_COOKIE, session.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
  return response;
}

export async function DELETE(request: NextRequest) {
  const { tenantId, sessionId } = await getContext(request);
  if (tenantId && sessionId) await endEmployeeSession(tenantId, sessionId);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
