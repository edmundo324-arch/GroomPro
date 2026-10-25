import {withRequestPolicy} from '@/src/lib/request-policy';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";

const SESSION_COOKIE = "groompro_session";
const tenantFrom = (request: NextRequest) => request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || "";

async function sessionFor(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value || "";
  return tenantId && sessionId ? getActiveEmployeeSession(tenantId, sessionId) : null;
}

async function handlePolicyGET(request: NextRequest) {
  const session = await sessionFor(request);
  if (!session) return NextResponse.json({ error: "Employee session required" }, { status: 401 });
  const permissions = await db.rolePermission.findMany({ where: { tenantId: session.tenantId }, orderBy: [{ role: "asc" }, { permissionCode: "asc" }] });
  return NextResponse.json({ permissions });
}

async function handlePolicyPUT(request: NextRequest) {
  const session = await sessionFor(request);
  if (!session) return NextResponse.json({ error: "Employee session required" }, { status: 401 });
  if (!['DEVELOPER','ADMIN'].includes(session.user.role) && session.user.role !== "MANAGER") return NextResponse.json({ error: "Manager access required" }, { status: 403 });
  const body = await request.json();
  if (!body.role || !body.permissionCode) return NextResponse.json({ error: "Role and permission are required" }, { status: 400 });
  if(body.role==='DEVELOPER')return NextResponse.json({error:'Developer authority cannot be changed through tenant permissions.'},{status:403});
  const permission = await db.rolePermission.upsert({
    where: { tenantId_role_permissionCode: { tenantId: session.tenantId, role: body.role, permissionCode: body.permissionCode } },
    update: { enabled: Boolean(body.enabled) },
    create: { tenantId: session.tenantId, role: body.role, permissionCode: body.permissionCode, enabled: Boolean(body.enabled) },
  });
  return NextResponse.json({ permission });
}

export const GET=withRequestPolicy(handlePolicyGET, {configure:true});
export const PUT=withRequestPolicy(handlePolicyPUT, {configure:true});
