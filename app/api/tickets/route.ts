import {resolveSaleLines} from "@/src/lib/pos-lines";
import { appointmentHoursError } from "@/src/lib/location-hours";
import { requestLocation } from "@/src/lib/request-location";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { writeAudit } from "@/src/lib/audit";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";
import { checkCustomerBookingRules } from "@/src/lib/booking-rules";

const SESSION_COOKIE = "groompro_session";
function tenantFrom(request: NextRequest) { return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || ""; }
type TicketLineRole = "PREP" | "BATH" | "GROOM" | "ADD_ON" | "PRODUCT";
type LineInput = { type: "SERVICE" | "PRODUCT" | "PACKAGE"; id: string; petId?: string; quantity?: number; role?: TicketLineRole; assignedUserId?: string; sortOrder?: number };
type PetDetailInput = { petId: string; weightLbs?: number | null; analSituation?: "DONE_REQUESTED" | "DONE_NOT_REQUESTED" | "NOT_NEEDED" | null; vipAvailability?: "AVAILABLE" | "NOT_AVAILABLE" | "NEEDS_MORE_SESSIONS" | null };

export async function POST(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const locationId = await requestLocation(request, tenantId);
  if (!tenantId || !locationId) return NextResponse.json({ error: "Tenant and location context are required." }, { status: 401 });
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value || "";
  const session = sessionId ? await getActiveEmployeeSession(tenantId, sessionId) : null;
  if (!session) return NextResponse.json({ error: "Employee PIN is required before creating a ticket." }, { status: 401 });
  let body: { customerId?: string; petId?: string; petIds?: string[]; petDetails?: PetDetailInput[]; serviceId?: string; serviceIds?: string[]; lines?: LineInput[]; scheduledStart?: string; durationMin?: number; notes?: string; groomerId?: string; arrivalPriority?: number; bookingSource?: "STAFF"|"ONLINE"; onlineCategory?: "GROOMING"|"FULL_WASH"|"NAIL_GRINDING"|"SELFSERVICE"|"DAYCARE"|"BOARDING"; confirmRecentWarning?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body.customerId || !body.scheduledStart) return NextResponse.json({ error: "Customer and appointment time are required." }, { status: 400 });
  if (body.arrivalPriority !== undefined && (!Number.isInteger(body.arrivalPriority) || body.arrivalPriority < 1)) return NextResponse.json({ error: "Arrival priority must be a positive whole number." }, { status: 400 });
  const scheduledStart = new Date(body.scheduledStart);
  if (Number.isNaN(scheduledStart.getTime())) return NextResponse.json({ error: "Invalid appointment time." }, { status: 400 });
  const petIds = [...new Set([...(body.petIds || []), ...(body.petId ? [body.petId] : []), ...(body.petDetails || []).map(p => p.petId)])];
  const lineInputs = body.lines?.length ? body.lines : (body.serviceId ? [{ type: "SERVICE" as const, id: body.serviceId, petId: body.petId }] : (body.serviceIds || []).map(id => ({ type: "SERVICE" as const, id, petId: body.petId })));
  if ((!petIds.length && lineInputs.some(l=>l.type!=="PRODUCT")) || !lineInputs.length) return NextResponse.json({ error: "At least one pet and one service or product are required." }, { status: 400 });
  const customer = await db.customer.findFirst({ where: { id: body.customerId, tenantId, active: true } });
  const pets = await db.pet.findMany({ where: { id: { in: petIds }, tenantId, customerId: body.customerId, active: true } });
  if (!customer || pets.length !== petIds.length) return NextResponse.json({ error: "Customer or pet could not be found." }, { status: 404 });
  let resolved;try{resolved=await resolveSaleLines(db,tenantId,lineInputs.map(l=>({...l,petId:l.petId||(l.type!=="PRODUCT"?petIds[0]:undefined)})),petIds,locationId)}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid items."},{status:400})}
  if(body.groomerId&&!await db.user.findFirst({where:{id:body.groomerId,tenantId,active:true}}))return NextResponse.json({error:"Scheduled groomer not found."},{status:400});
  const durationMin=resolved.durationMin;
  const hoursMessage=await appointmentHoursError(tenantId,locationId,scheduledStart,durationMin);if(hoursMessage)return NextResponse.json({error:hoursMessage},{status:400});
  const source = body.bookingSource === "ONLINE" ? "ONLINE" : "STAFF";
  const rules = await checkCustomerBookingRules(tenantId, customer.id, scheduledStart, durationMin);
  if (source === "ONLINE" && rules.hardOverlap) return NextResponse.json({ error: "This customer already has an appointment at this time. Online booking cannot double-book a customer.", conflicts: rules.conflicts }, { status: 409 });
  const customerWarnings = rules.conflicts;
  if (source === "STAFF" && customerWarnings.length && !body.confirmRecentWarning) return NextResponse.json({ warning: customerWarnings.some(c => c.type === "OVERLAP") ? "This customer already has an appointment at this time." : "This customer has another appointment within two weeks.", conflicts: customerWarnings, requiresConfirmation: true }, { status: 409 });
  const orderAggregate = await db.ticket.aggregate({ where: { tenantId }, _max: { orderNumber: true } });
  const orderNumber = (orderAggregate._max.orderNumber || 0) + 1;
  const lines=resolved.lines;
  const detailMap = new Map((body.petDetails || []).map(p => [p.petId, p]));
  const ticket = await db.$transaction(async tx => {
    const created = await tx.ticket.create({ data: { tenantId, locationId, customerId: customer.id, orderNumber, scheduledStart, durationMin, arrivalPriority: body.arrivalPriority ?? null, status: "OPEN", bookingSource: source, onlineCategory: body.onlineCategory || null, bookingDecision: source === "ONLINE" ? "REQUESTED" : "INTERNAL", requestedAt: source === "ONLINE" ? new Date() : null, notes: body.notes?.trim() || null, pets: { create: petIds.map(petId => { const d = detailMap.get(petId); return { petId, weightLbs: d?.weightLbs == null ? undefined : d.weightLbs, analSituation: d?.analSituation || null, vipAvailability: d?.vipAvailability || null }; }) }, lines: { create: lines }, ...(body.groomerId ? { assignments: { create: { userId: body.groomerId, role: "GROOMER" } } } : {}) }, include: { customer: true, pets: { include: { pet: true } }, lines: { include: { assignedUser: true, pet: true } }, assignments: { include: { user: true } } } });
    await tx.ticketScheduleHistory.create({ data: { tenantId, ticketId: created.id, actorUserId: session.user.id, changeType: "CREATED", previousStart: null, newStart: scheduledStart } });
    return created;
  });
  await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: ticket.id, customerId: customer.id, action: "CREATE", summary: `${source === "ONLINE" ? "Received online request" : "Created appointment"} #${orderNumber} for ${pets.map(p => p.name).join(", ")}.`, details: { scheduledStart: scheduledStart.toISOString(), petCount: petIds.length, lineCount: lines.length, arrivalPriority: body.arrivalPriority ?? null } });
  return NextResponse.json({ ticket, warnings: customerWarnings });
}

export async function PATCH(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const locationId = await requestLocation(request, tenantId);
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
  const hoursMessage=await appointmentHoursError(tenantId,locationId,newStart,ticket.durationMin);if(hoursMessage)return NextResponse.json({error:hoursMessage},{status:400});
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

