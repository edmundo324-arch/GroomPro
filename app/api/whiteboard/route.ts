import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { writeAudit } from "@/src/lib/audit";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";

const SESSION_COOKIE = "groompro_session";
function tenantFrom(request: NextRequest) { return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || ""; }

export async function GET(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const locationId = request.nextUrl.searchParams.get("locationId") || process.env.GROOMPRO_DEV_LOCATION_ID || "";
  const dateValue = request.nextUrl.searchParams.get("date");
  if (!tenantId || !locationId || !dateValue) return NextResponse.json({ error: "Tenant, location, and date are required." }, { status: 400 });
  const start = new Date(`${dateValue}T00:00:00`);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  if (Number.isNaN(start.getTime())) return NextResponse.json({ error: "Invalid whiteboard date." }, { status: 400 });

  const tickets = await db.ticket.findMany({
    where: { tenantId, locationId, scheduledStart: { gte: start, lt: end }, status: { notIn: ["CANCELLED"] } },
    orderBy: [{ scheduledStart: "asc" }, { orderNumber: "asc" }],
    include: {
      customer: { select: { id: true, firstName: true, lastName: true } },
      pets: { include: { pet: { select: { id: true, name: true, breed: true } } } },
      lines: { orderBy: { sortOrder: "asc" }, include: { assignedUser: { select: { id: true, firstName: true, lastName: true } }, pet: { select: { id: true, name: true } } } },
    },
  });
  return NextResponse.json({ tickets });
}

export async function PATCH(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const locationId = request.nextUrl.searchParams.get("locationId") || process.env.GROOMPRO_DEV_LOCATION_ID || "";
  if (!tenantId || !locationId) return NextResponse.json({ error: "Tenant and location context are required." }, { status: 401 });
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value || "";
  const session = sessionId ? await getActiveEmployeeSession(tenantId, sessionId) : null;
  if (!session) return NextResponse.json({ error: "Employee PIN is required before changing the whiteboard." }, { status: 401 });

  let body: { ticketId?: string; action?: "PRIORITY" | "VIP" | "ANAL" | "ASSIGN"; value?: number | string | null; petId?: string; lineRole?: "PREP" | "BATH" | "GROOM"; userId?: string | null };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body.ticketId || !body.action) return NextResponse.json({ error: "Ticket and whiteboard action are required." }, { status: 400 });
  const ticket = await db.ticket.findFirst({ where: { id: body.ticketId, tenantId, locationId }, include: { pets: true } });
  if (!ticket) return NextResponse.json({ error: "Ticket could not be found." }, { status: 404 });

  if (body.action === "PRIORITY") {
    if (body.value !== null && body.value !== undefined && (!/^\d+$/.test(String(body.value)) || Number(body.value) < 1)) return NextResponse.json({ error: "Priority must be a positive whole number." }, { status: 400 });
    const updated = await db.ticket.update({ where: { id: ticket.id }, data: { arrivalPriority: body.value === null || body.value === undefined ? null : Number(body.value) } });
    await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: ticket.id, customerId: ticket.customerId, action: "WHITEBOARD_PRIORITY", summary: `Changed whiteboard priority for order #${ticket.orderNumber}.`, details: { previous: ticket.arrivalPriority, next: updated.arrivalPriority, entryMethod: "EMPLOYEE_OR_FRONT_DESK" } });
    return NextResponse.json({ ticket: updated });
  }

  if (body.action === "ASSIGN") {
    if (!body.petId || !ticket.pets.some(p => p.petId === body.petId)) return NextResponse.json({ error: "A dog on this ticket must be selected." }, { status: 400 });
    if (!body.lineRole) return NextResponse.json({ error: "Workflow assignment role is required." }, { status: 400 });
    if (body.userId) {
      const employee = await db.user.findFirst({ where: { id: body.userId, tenantId, active: true, OR: [{ locationId }, { locationId: null }] }, select: { id: true } });
      if (!employee) return NextResponse.json({ error: "Employee could not be found." }, { status: 404 });
    }
    const line = await db.ticketLine.findFirst({ where: { ticketId: ticket.id, petId: body.petId, role: body.lineRole } });
    if (!line) return NextResponse.json({ error: "Workflow service line could not be found for this dog." }, { status: 404 });
    const updated = await db.ticketLine.update({ where: { id: line.id }, data: { assignedUserId: body.userId || null, assignedAt: body.userId ? new Date() : null } });
    await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: ticket.id, customerId: ticket.customerId, action: "WHITEBOARD_ASSIGN", summary: `Changed ${body.lineRole} assignment for ${body.petId} on order #${ticket.orderNumber}.`, details: { petId: body.petId, role: body.lineRole, previousUserId: line.assignedUserId, nextUserId: body.userId || null } });
    return NextResponse.json({ line: updated });
  }

  if (!body.petId || !ticket.pets.some(p => p.petId === body.petId)) return NextResponse.json({ error: "A dog on this ticket must be selected." }, { status: 400 });
  const pet = ticket.pets.find(p => p.petId === body.petId)!;
  if (body.action === "VIP") {
    const value = body.value as string;
    if (!["AVAILABLE", "NOT_AVAILABLE", "NEEDS_MORE_SESSIONS"].includes(value)) return NextResponse.json({ error: "Invalid VIP availability." }, { status: 400 });
    const updated = await db.ticketPet.update({ where: { id: pet.id }, data: { vipAvailability: value as any } });
    await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: ticket.id, customerId: ticket.customerId, action: "WHITEBOARD_VIP", summary: `Changed VIP availability for ${body.petId} on order #${ticket.orderNumber}.`, details: { petId: body.petId, previous: pet.vipAvailability, next: value } });
    return NextResponse.json({ ticketPet: updated });
  }

  const value = body.value as string;
  if (!["DONE_REQUESTED", "DONE_NOT_REQUESTED", "NOT_NEEDED"].includes(value)) return NextResponse.json({ error: "Invalid anal situation status." }, { status: 400 });
  const updated = await db.ticketPet.update({ where: { id: pet.id }, data: { analSituation: value as any } });
  await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: ticket.id, customerId: ticket.customerId, action: "WHITEBOARD_ANAL", summary: `Changed Anal Situation for ${body.petId} on order #${ticket.orderNumber}.`, details: { petId: body.petId, previous: pet.analSituation, next: value } });
  return NextResponse.json({ ticketPet: updated });
}
