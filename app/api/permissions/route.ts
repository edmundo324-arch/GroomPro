import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveEmployeeSession } from "@/lib/employee-session";

export async function GET(req: NextRequest) {
  const session = await getActiveEmployeeSession(req);
  if (!session) return NextResponse.json({ error: "Employee session required" }, { status: 401 });
  const permissions = await prisma.rolePermission.findMany({ where: { tenantId: session.tenantId }, orderBy: [{ role: "asc" }, { permissionCode: "asc" }] });
  return NextResponse.json({ permissions });
}

export async function PUT(req: NextRequest) {
  const session = await getActiveEmployeeSession(req);
  if (!session) return NextResponse.json({ error: "Employee session required" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") return NextResponse.json({ error: "Manager access required" }, { status: 403 });
  const body = await req.json();
  if (!body.role || !body.permissionCode) return NextResponse.json({ error: "Role and permission are required" }, { status: 400 });
  const permission = await prisma.rolePermission.upsert({
    where: { tenantId_role_permissionCode: { tenantId: session.tenantId, role: body.role, permissionCode: body.permissionCode } },
    update: { enabled: Boolean(body.enabled) },
    create: { tenantId: session.tenantId, role: body.role, permissionCode: body.permissionCode, enabled: Boolean(body.enabled) },
  });
  return NextResponse.json({ permission });
}
