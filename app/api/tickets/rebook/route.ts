import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { writeAudit } from "@/src/lib/audit";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";
import { checkCustomerBookingRules } from "@/src/lib/booking-rules";

const COOKIE = "groompro_session";
const tenantFrom = (r: NextRequest) => r.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || "";

export async function POST(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const locationId = request.nextUrl.searchParams.get("locationId") || process.env.GROOMPRO_DEV_LOCATION_ID || "";
  const sid = request.cookies.get(COOKIE)?.value || "";
  const session = tenantId && sid ? await getActiveEmployeeSession(tenantId, sid) : null;
  if (!tenantId || !locationId) return NextResponse.json({ error: "Tenant and location context are required." }, { status: 401 });
  if (!session) return NextResponse.json({ error: "Employee PIN is required before rebooking." }, { status: 401 });

  try {
    const body = await request.json();
    const ticketId = String(body.ticketId || "");
    const scheduledStart = new Date(String(body.scheduledStart || ""));
    const groomerId = body.groomerId ? String(body.groomerId) : null;
    if (!ticketId || Number.isNaN(scheduledStart.getTime())) return NextResponse.json({ error: "Original ticket and a valid new appointment time are required." }, { status: 400 });

    const source = await db.ticket.findFirst({
      where: { id: ticketId, tenantId, locationId },
      include: { pets: true, lines: { orderBy: { sortOrder: "asc" } } }
    });
    if (!source) return NextResponse.json({ error: "Original ticket could not be found." }, { status: 404 });
    if (source.status === "CANCELLED") return NextResponse.json({ error: "A cancelled appointment cannot be rebooked." }, { status: 409 });

    const durationMin = Math.max(15, source.durationMin || 30);
    const rules = await checkCustomerBookingRules(tenantId, source.customerId, scheduledStart, durationMin);
    if (rules.hardOverlap) return NextResponse.json({ error: "This customer already has an appointment at the selected time.", conflicts: rules.conflicts }, { status: 409 });
    if (rules.conflicts.length && !body.confirmRecentWarning) return NextResponse.json({ error: "This customer has another appointment close to the selected time.", conflicts: rules.conflicts, requiresConfirmation: true }, { status: 409 });

    if (groomerId) {
      const groomer = await db.user.findFirst({ where: { id: groomerId, tenantId, active: true, OR: [{ locationId }, { locationId: null }] }, select: { id: true } });
      if (!groomer) return NextResponse.json({ error: "Selected groomer could not be found." }, { status: 404 });
    }

    const maxOrder = await db.ticket.aggregate({ where: { tenantId }, _max: { orderNumber: true } });
    const orderNumber = (maxOrder._max.orderNumber || 0) + 1;
    const serviceLines = source.lines.filter(line => line.lineType === "SERVICE");

    const created = await db.$transaction(async tx => {
      const ticket = await tx.ticket.create({
        data: {
          tenantId,
          locationId,
          customerId: source.customerId,
          orderNumber,
          scheduledStart,
          durationMin,
          status: "OPEN",
          bookingSource: "STAFF",
          bookingDecision: "INTERNAL",
          notes: source.notes,
          pets: { create: source.pets.map(p => ({ petId: p.petId, weightLbs: p.weightLbs, analSituation: null, vipAvailability: p.vipAvailability })) },
          lines: { create: serviceLines.map((line, index) => ({ lineType: "SERVICE", role: line.role, serviceId: line.serviceId, petId: line.petId, description: line.description, quantity: line.quantity, unitPriceCents: line.unitPriceCents, discountCents: 0, totalCents: line.unitPriceCents * line.quantity, commissionPct: line.commissionPct, commissionCents: Math.round((line.unitPriceCents * line.quantity) * Number(line.commissionPct || 0) / 100), sortOrder: index, assignedUserId: null, assignedAt: null })) },
          ...(groomerId ? { assignments: { create: { userId: groomerId, role: "GROOMER" } } } : {})
        },
        include: { customer: true, pets: { include: { pet: true } }, lines: { include: { pet: true, service: true } }, assignments: { include: { user: true } } }
      });
      await tx.ticketScheduleHistory.create({ data: { tenantId, ticketId: ticket.id, actorUserId: session.user.id, changeType: "CREATED", previousStart: null, newStart: scheduledStart } });
      return ticket;
    });

    await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: created.id, customerId: source.customerId, action: "REBOOK", summary: `Rebooked ticket #${source.orderNumber} as appointment #${orderNumber}.`, details: { sourceTicketId: source.id, scheduledStart: scheduledStart.toISOString(), groomerId } });
    return NextResponse.json({ ticket: created, warnings: rules.conflicts });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to rebook appointment." }, { status: 400 });
  }
}
