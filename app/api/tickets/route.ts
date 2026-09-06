import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { writeAudit } from "@/src/lib/audit";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";
import { checkCustomerBookingRules } from "@/src/lib/booking-rules";

const SESSION_COOKIE = "groompro_session";
function tenantFrom(request: NextRequest) { return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || ""; }
type LineInput = { type: "SERVICE" | "PRODUCT"; id: string; petId?: string; quantity?: number };

export async function POST(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const locationId = request.nextUrl.searchParams.get("locationId") || process.env.GROOMPRO_DEV_LOCATION_ID || "";
  if (!tenantId || !locationId) return NextResponse.json({ error: "Tenant and location context are required." }, { status: 401 });
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value || "";
  const session = sessionId ? await getActiveEmployeeSession(tenantId, sessionId) : null;
  if (!session) return NextResponse.json({ error: "Employee PIN is required before creating a ticket." }, { status: 401 });
  let body: { customerId?: string; petId?: string; petIds?: string[]; serviceId?: string; serviceIds?: string[]; lines?: LineInput[]; scheduledStart?: string; durationMin?: number; notes?: string; groomerId?: string; bookingSource?: "STAFF"|"ONLINE"; onlineCategory?: "GROOMING"|"FULL_WASH"|"NAIL_GRINDING"|"SELFSERVICE"|"DAYCARE"|"BOARDING"; confirmRecentWarning?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body.customerId || !body.scheduledStart) return NextResponse.json({ error: "Customer and appointment time are required." }, { status: 400 });
  const scheduledStart = new Date(body.scheduledStart);
  if (Number.isNaN(scheduledStart.getTime())) return NextResponse.json({ error: "Invalid appointment time." }, { status: 400 });
  const petIds = [...new Set([...(body.petIds || []), ...(body.petId ? [body.petId] : [])])];
  const lineInputs = body.lines?.length ? body.lines : (body.serviceId ? [{ type: "SERVICE" as const, id: body.serviceId, petId: body.petId }] : (body.serviceIds || []).map(id => ({ type: "SERVICE" as const, id, petId: body.petId })));
  if (!petIds.length || !lineInputs.length) return NextResponse.json({ error: "At least one pet and one service or product are required." }, { status: 400 });
  const customer = await db.customer.findFirst({ where: { id: body.customerId, tenantId, active: true } });
  const pets = await db.pet.findMany({ where: { id: { in: petIds }, tenantId, customerId: body.customerId, active: true } });
  if (!customer || pets.length !== petIds.length) return NextResponse.json({ error: "Customer or pet could not be found." }, { status: 404 });
  const serviceIds = [...new Set(lineInputs.filter(l => l.type === "SERVICE").map(l => l.id))];
  const productIds = [...new Set(lineInputs.filter(l => l.type === "PRODUCT").map(l => l.id))];
  const [services, products] = await Promise.all([serviceIds.length ? db.service.findMany({ where: { id: { in: serviceIds }, tenantId, active: true } }) : Promise.resolve([]), productIds.length ? db.product.findMany({ where: { id: { in: productIds }, tenantId, active: true } }) : Promise.resolve([])]);
  if (services.length !== serviceIds.length || products.length !== productIds.length) return NextResponse.json({ error: "One or more services or products could not be found." }, { status: 404 });
  const durationMin = Math.max(15, Number(body.durationMin) || services.reduce((sum, s) => sum + s.durationMin, 0) || 30);
  const source = body.bookingSource === "ONLINE" ? "ONLINE" : "STAFF";
  const rules = await checkCustomerBookingRules(tenantId, customer.id, scheduledStart, durationMin);
  if (source === "ONLINE" && rules.hardOverlap) return NextResponse.json({ error: "This customer already has an appointment at this time. Online booking cannot double-book a customer.", conflicts: rules.conflicts }, { status: 409 });
  const customerWarnings = rules.conflicts;
  if (source === "STAFF" && customerWarnings.length && !body.confirmRecentWarning) return NextResponse.json({ warning: customerWarnings.some(c => c.type === "OVERLAP") ? "This customer already has an appointment at this time." : "This customer has another appointment within two weeks.", conflicts: customerWarnings, requiresConfirmation: true }, { status: 409 });
  const orderAggregate = await db.ticket.aggregate({ where: { tenantId }, _max: { orderNumber: true } });
  const orderNumber = (orderAggregate._max.orderNumber || 0) + 1;
  const serviceMap = new Map(services.map(s => [s.id, s]));
  const productMap = new Map(products.map(p => [p.id, p]));
  const lines = lineInputs.map(line => { const quantity = Math.max(1, Number(line.quantity) || 1); if (line.type === "SERVICE") { const s = serviceMap.get(line.id)!; return { lineType: "SERVICE" as const, serviceId: s.id, petId: line.petId && petIds.includes(line.petId) ? line.petId : petIds[0], description: s.name, quantity, unitPriceCents: s.priceCents, totalCents: s.priceCents * quantity }; } const p = productMap.get(line.id)!; return { lineType: "PRODUCT" as const, productId: p.id, description: p.name, quantity, unitPriceCents: p.priceCents, totalCents: p.priceCents * quantity }; });
  const ticket = await db.$transaction(async tx => {
    const created = await tx.ticket.create({ data: { tenantId, locationId, customerId: customer.id, orderNumber, scheduledStart, durationMin, status: "OPEN", bookingSource: source, onlineCategory: body.onlineCategory || null, bookingDecision: source === "ONLINE" ? "REQUESTED" : "INTERNAL", requestedAt: source === "ONLINE" ? new Date() : null, notes: body.notes?.trim() || null, pets: { create: petIds.map(petId => ({ petId })) }, lines: { create: lines }, ...(body.groomerId ? { assignments: { create: { userId: body.groomerId, role: "GROOMER" } } } : {}) }, include: { customer: true, pets: { include: { pet: true } }, lines: true, assignments: { include: { user: true } } } });
    await tx.ticketScheduleHistory.create({ data: { tenantId, ticketId: created.id, actorUserId: session.user.id, changeType: "CREATED", previousStart: null, newStart: scheduledStart } });
    return created;
  });
  await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: ticket.id, customerId: customer.id, action: "CREATE", summary: `${source === "ONLINE" ? "Received online request" : "Created appointment"} #${orderNumber} for ${pets.map(p => p.name).join(", ")}.`, details: { scheduledStart: scheduledStart.toISOString() } });
  return NextResponse.json({ ticket, warnings: customerWarnings });
}

export async function PATCH(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const locationId = request.nextUrl.searchParams.get("locationId") || process.env.GROOMPRO_DEV_LOCATION_ID || "";
  if (!tenantId || !locationId) return NextResponse.json({ error: "Tenant and location context are required." }, { status: 401 });
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value || "";
  const session = sessionId ? await getActiveEmployeeSession(tenantId, sessionId) : null;
  if (!session) return NextResponse.json({ error: "Employee PIN is required before changing an appointment." }, { status: 401 });
  let body: { ticketId?: string; scheduledStart?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body.ticketId || !body.scheduledStart) return NextResponse.json({ error: "Ticket and new appointment time are required." }, { status: 400 });
  const newStart = new Date(body.scheduledStart);
  if (Number.isNaN(newStart.getTime())) return NextResponse.json({ error: "Invalid appointment time." }, { status: 400 });
  const ticket = await db.ticket.findFirst({ where: { id: body.ticketId, tenantId, locationId }, include: { customer: true, pets: { include: { pet: true } } } });
  if (!ticket) return NextResponse.json({ error: "Appointment could not be found." }, { status: 404 });
  if (!ticket.scheduledStart) return NextResponse.json({ error: "This appointment has no scheduled time to move." }, { status: 400 });
  if (ticket.scheduledStart.getTime() === newStart.getTime()) return NextResponse.json({ ticket, moved: false });
  const previousStart = ticket.scheduledStart;
  const updated = await db.$transaction(async tx => {
    const changed = await tx.ticket.update({ where: { id: ticket.id }, data: { scheduledStart: newStart } });
    await tx.ticketScheduleHistory.create({ data: { tenantId, ticketId: ticket.id, actorUserId: session.user.id, changeType: "MOVED", previousStart, newStart } });
    return changed;
  });
  await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: ticket.id, customerId: ticket.customerId, action: "MOVE", summary: `Moved appointment #${ticket.orderNumber} from ${previousStart.toLocaleString()} to ${newStart.toLocaleString()}.`, details: { previousStart: previousStart.toISOString(), newStart: newStart.toISOString() } });
  return NextResponse.json({ ticket: updated, moved: true, previousStart, newStart });
}
