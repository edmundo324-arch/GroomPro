import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { writeAudit } from "@/src/lib/audit";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";

const SESSION_COOKIE = "groompro_session";

function tenantFrom(request: NextRequest) {
  return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || "";
}

export async function PATCH(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const locationId = request.nextUrl.searchParams.get("locationId") || process.env.GROOMPRO_DEV_LOCATION_ID || "";
  if (!tenantId || !locationId) return NextResponse.json({ error: "Tenant and location context are required." }, { status: 401 });

  const sessionId = request.cookies.get(SESSION_COOKIE)?.value || "";
  const session = sessionId ? await getActiveEmployeeSession(tenantId, sessionId) : null;
  if (!session) return NextResponse.json({ error: "Employee PIN is required before changing daycare status." }, { status: 401 });

  let body: { ticketId?: string; staying?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body.ticketId || typeof body.staying !== "boolean") return NextResponse.json({ error: "Ticket and daycare selection are required." }, { status: 400 });

  const ticket = await db.ticket.findFirst({ where: { id: body.ticketId, tenantId, locationId }, include: { customer: true, pets: { include: { pet: true } } } });
  if (!ticket) return NextResponse.json({ error: "Ticket could not be found." }, { status: 404 });
  if (ticket.status !== "READY" && ticket.status !== "CLOSED") return NextResponse.json({ error: "Daycare is offered and assigned when the ticket is ready for pickup." }, { status: 409 });

  const updated = await db.ticket.update({
    where: { id: ticket.id },
    data: {
      daycareStatus: body.staying ? "STAYING" : "NONE",
      daycareAddedAt: body.staying ? new Date() : null,
      daycareAddedByUserId: body.staying ? session.user.id : null,
    },
    include: { customer: true, pets: { include: { pet: true } } },
  });

  await writeAudit({
    tenantId,
    actorUserId: session.user.id,
    entityType: "TICKET",
    entityId: ticket.id,
    customerId: ticket.customerId,
    action: body.staying ? "ADD_DAYCARE" : "REMOVE_DAYCARE",
    summary: `${body.staying ? "Added" : "Removed"} ticket-level daycare for order #${ticket.orderNumber}.`,
    details: {
      daycareStatus: updated.daycareStatus,
      ticketLevel: true,
      affectsAllDogsOnTicket: true,
      petIds: ticket.pets.map(p => p.petId),
    },
  });

  return NextResponse.json({ ticket: updated, daycareStatus: updated.daycareStatus, affectsAllDogsOnTicket: true });
}
