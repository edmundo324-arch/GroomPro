import {onlineBlockError,resourceBlocked} from '@/src/lib/calendar-blocks';
import {nextTicketNumber} from '@/src/lib/ticket-number';
import {employeeAvailable,reconcileEmployeeAssignments,syncActualGroomers} from '@/src/lib/groomer-assignment';
import {ticketDuration,timingMode} from '@/src/lib/ticket-timing';
import {workflowSettings} from '@/src/lib/workflow-settings';
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
type LineInput = {packageId?:string;durationMin?:number; type: "SERVICE" | "PRODUCT" | "PACKAGE"; id: string; petId?: string; quantity?: number; role?: TicketLineRole; assignedUserId?: string; sortOrder?: number };
type PetDetailInput = { petId: string; weightLbs?: number | null; analSituation?: "DONE_REQUESTED" | "DONE_NOT_REQUESTED" | "NOT_NEEDED" | null; vipAvailability?: "AVAILABLE" | "NOT_AVAILABLE" | "NEEDS_MORE_SESSIONS" | null };

export async function POST(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const locationId = await requestLocation(request, tenantId);
  if (!tenantId || !locationId) return NextResponse.json({ error: "Tenant and location context are required." }, { status: 401 });
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value || "";
  const session = sessionId ? await getActiveEmployeeSession(tenantId, sessionId) : null;
  if (!session) return NextResponse.json({ error: "Employee PIN is required before creating a ticket." }, { status: 401 });
  let body: { draftId?:string; tipCents?:number;salesTaxCents?:number;timingMode?:string;customerId?: string; petId?: string; petIds?: string[]; petDetails?: PetDetailInput[]; serviceId?: string; serviceIds?: string[]; lines?: LineInput[]; scheduledStart?: string; durationMin?: number; notes?: string; groomerId?: string; arrivalPriority?: number; bookingSource?: "STAFF"|"ONLINE"; onlineCategory?: "GROOMING"|"FULL_WASH"|"NAIL_GRINDING"|"SELFSERVICE"|"DAYCARE"|"BOARDING"; confirmRecentWarning?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body.customerId) return NextResponse.json({ error: "Customer is required." }, { status: 400 });
  if([body.tipCents,body.salesTaxCents].some(v=>v!==undefined&&(!Number.isInteger(v)||v<0||v>2147483647)))return NextResponse.json({error:"Invalid tax or tip."},{status:400});
  if (body.arrivalPriority !== undefined && (!Number.isInteger(body.arrivalPriority) || body.arrivalPriority < 1)) return NextResponse.json({ error: "Arrival priority must be a positive whole number." }, { status: 400 });
  const scheduledStart = body.scheduledStart?new Date(body.scheduledStart):null;
  if (scheduledStart&&Number.isNaN(scheduledStart.getTime())) return NextResponse.json({ error: "Invalid appointment time." }, { status: 400 });
  const petIds = [...new Set([...(body.petIds || []), ...(body.petId ? [body.petId] : []), ...(body.petDetails || []).map(p => p.petId)])];
  const lineInputs = body.lines?.length ? body.lines : (body.serviceId ? [{ type: "SERVICE" as const, id: body.serviceId, petId: body.petId }] : (body.serviceIds || []).map(id => ({ type: "SERVICE" as const, id, petId: body.petId })));
  if ((!petIds.length && lineInputs.some(l=>l.type!=="PRODUCT")) || !lineInputs.length) return NextResponse.json({ error: "At least one pet and one service or product are required." }, { status: 400 });
  const customer = await db.customer.findFirst({ where: { id: body.customerId, tenantId, active: true } });
  const pets = await db.pet.findMany({ where: { id: { in: petIds }, tenantId, customerId: body.customerId, active: true } });
  if (!customer || pets.length !== petIds.length) return NextResponse.json({ error: "Customer or pet could not be found." }, { status: 404 });
  let resolved;try{resolved=await resolveSaleLines(db,tenantId,lineInputs.map(l=>({...l,petId:l.petId||(l.type!=="PRODUCT"?petIds[0]:undefined)})),petIds,locationId)}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid items."},{status:400})}
  if(body.groomerId&&!await db.user.findFirst({where:{id:body.groomerId,tenantId,active:true}}))return NextResponse.json({error:"Selected groomer not found."},{status:400});
  let mode;try{mode=timingMode(body.timingMode||(await workflowSettings(tenantId)).timingMode)}catch(e){return NextResponse.json({error:String(e)},{status:400})}const durationMin=ticketDuration(resolved.lines,mode);const groups=new Set<string>();for(const line of resolved.lines){if(line.packageId){const key=line.packageGroupKey+':'+line.serviceId;if(groups.has(key))return NextResponse.json({error:'This package service is already on the ticket.'},{status:400});groups.add(key)}}
  if(body.groomerId&&scheduledStart&&!await employeeAvailable(tenantId,body.groomerId,locationId,scheduledStart,durationMin))return NextResponse.json({error:'Choose an available groomer or Assign later.'},{status:409});
  if(scheduledStart)for(const userId of new Set(resolved.lines.map(l=>l.assignedUserId).filter((id):id is string=>!!id)))if(!await employeeAvailable(tenantId,userId,locationId,scheduledStart,durationMin))return NextResponse.json({error:'This employee is unavailable for this appointment.'},{status:409});
  const hoursMessage=scheduledStart?await appointmentHoursError(tenantId,locationId,scheduledStart,durationMin):null;if(hoursMessage)return NextResponse.json({error:hoursMessage},{status:400});
  const source = body.bookingSource === "ONLINE" ? "ONLINE" : "STAFF";
  if(source === "ONLINE" && !scheduledStart) return NextResponse.json({error:"Online appointments require a scheduled date and time."},{status:400});
  if(source==='ONLINE'&&scheduledStart){const blocked=await onlineBlockError(tenantId,locationId,scheduledStart,durationMin,body.onlineCategory);if(blocked)return NextResponse.json({error:blocked},{status:409});}
  const rules = scheduledStart?await checkCustomerBookingRules(tenantId, customer.id, scheduledStart, durationMin):{hardOverlap:false,conflicts:[]};
  if (source === "ONLINE" && rules.hardOverlap) return NextResponse.json({ error: "This customer already has an appointment at this time. Online booking cannot double-book a customer.", conflicts: rules.conflicts }, { status: 409 });
  const customerWarnings = rules.conflicts;
  if (source === "STAFF" && customerWarnings.length && !body.confirmRecentWarning) return NextResponse.json({ warning: customerWarnings.some(c => c.type === "OVERLAP") ? "This customer already has an appointment at this time." : "This customer has another appointment within two weeks.", conflicts: customerWarnings, requiresConfirmation: true }, { status: 409 });
  let orderNumber=0;
  const lines=resolved.lines;
  const detailMap = new Map((body.petDetails || []).map(p => [p.petId, p]));
  const ticket = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
    const draft=body.draftId?await tx.posDraft.findFirst({where:{id:body.draftId,tenantId,locationId}}):null;
    if(body.draftId&&!draft)throw Error('Draft not found.');
    if(draft?.promotedAt){const existing=await tx.ticket.findFirst({where:{id:draft.id,tenantId}});if(existing)return existing;}
    orderNumber=draft?.orderNumber||await nextTicketNumber(tx,tenantId);
    const created = await tx.ticket.create({ data: { ...(draft?{id:draft.id,createdAt:draft.createdAt}:{}),tenantId, locationId, customerId: customer.id, tipCents:body.tipCents||0,salesTaxCents:body.salesTaxCents||0,orderNumber, scheduledStart, durationMin, timingMode:mode, arrivalPriority: body.arrivalPriority ?? null, status: "OPEN", bookingSource: source, onlineCategory: body.onlineCategory || null, bookingDecision: source === "ONLINE" ? "REQUESTED" : "INTERNAL", requestedAt: source === "ONLINE" ? new Date() : null, notes: body.notes?.trim() || null, pets: { create: petIds.map(petId => { const d = detailMap.get(petId); return { petId, weightLbs: d?.weightLbs == null ? undefined : d.weightLbs, analSituation: d?.analSituation || null, vipAvailability: d?.vipAvailability || null }; }) }, lines: { create: lines }, ...(body.groomerId ? { assignments: { create: [{ userId: body.groomerId, role: "GROOMER" },{userId:body.groomerId,role:"PLANNED_GROOMER"}] } } : {}) }, include: { customer: true, pets: { include: { pet: true } }, lines: { include: { assignedUser:{select:{id:true,firstName:true,lastName:true,role:true,active:true}}, pet: true } }, assignments: { include: { user:{select:{id:true,firstName:true,lastName:true,role:true,active:true}} } } } });
    if(lines.some(l=>l.role==='GROOM'&&l.assignedUserId))await syncActualGroomers(tx,created.id);
    if(scheduledStart)await tx.ticketScheduleHistory.create({ data: { tenantId, ticketId: created.id, actorUserId: session.user.id, changeType: "CREATED", previousStart: null, newStart: scheduledStart } });
    if(draft)await tx.posDraft.update({where:{id:draft.id},data:{promotedAt:new Date()}});
    return created;
  });
  await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: ticket.id, customerId: customer.id, action: "CREATE", summary: `${source === "ONLINE" ? "Received online request" : "Created appointment"} #${orderNumber} for ${pets.map(p => p.name).join(", ")}.`, details: { scheduledStart: scheduledStart?.toISOString()||null, petCount: petIds.length, lineCount: lines.length, arrivalPriority: body.arrivalPriority ?? null } });
  return NextResponse.json({ ticket, warnings: customerWarnings });
}

export async function PATCH(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const locationId = await requestLocation(request, tenantId);
  if (!tenantId || !locationId) return NextResponse.json({ error: "Tenant and location context are required." }, { status: 401 });
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value || "";
  const session = sessionId ? await getActiveEmployeeSession(tenantId, sessionId) : null;
  if (!session) return NextResponse.json({ error: "Employee PIN is required before changing an appointment." }, { status: 401 });
  let body: { ticketId?: string; scheduledStart?: string; groomerId?:string|null; expectedStart?:string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body.ticketId || !body.scheduledStart) return NextResponse.json({ error: "Ticket and new appointment time are required." }, { status: 400 });
  const newStart = new Date(body.scheduledStart);
  if (Number.isNaN(newStart.getTime())) return NextResponse.json({ error: "Invalid appointment time." }, { status: 400 });
  const ticket = await db.ticket.findFirst({ where: { id: body.ticketId, tenantId, locationId }, include: { customer: true, pets: { include: { pet: true } } } });
  if (!ticket) return NextResponse.json({ error: "Appointment could not be found." }, { status: 404 });
  if(['CLOSED','CANCELLED','NO_SHOW'].includes(ticket.status))return NextResponse.json({error:'This appointment is closed.'},{status:409});
  if(body.groomerId!==undefined&&ticket.checkedInAt)return NextResponse.json({error:'Change actual employee assignments in the POS Ticket or Whiteboard after check-in.'},{status:409});
  if(body.groomerId&&!await employeeAvailable(tenantId,body.groomerId,locationId,newStart,ticket.durationMin))return NextResponse.json({error:'The selected employee is unavailable at this time.'},{status:409});
  if(body.groomerId===undefined){const assigned=await db.ticketAssignment.findMany({where:{ticketId:ticket.id,role:'GROOMER'}});for(const a of assigned)if(await resourceBlocked(tenantId,locationId,'employee',a.userId,newStart,ticket.durationMin))return NextResponse.json({error:'This employee has a time block at the selected time.'},{status:409});}
  const hoursMessage=await appointmentHoursError(tenantId,locationId,newStart,ticket.durationMin);if(hoursMessage)return NextResponse.json({error:hoursMessage},{status:400});
  if (body.groomerId===undefined&&ticket.scheduledStart?.getTime() === newStart.getTime()) return NextResponse.json({ ticket, moved: false });
  const previousStart = ticket.scheduledStart;
  const updated = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM Ticket WHERE id=${ticket.id} AND tenantId=${tenantId} FOR UPDATE`;
    const live=await tx.ticket.findUnique({where:{id:ticket.id}});
    if(body.expectedStart&&live?.scheduledStart?.toISOString()!==body.expectedStart)throw Error('Appointment changed elsewhere. Refresh before moving.');
    if(body.groomerId!==undefined){await tx.ticketAssignment.deleteMany({where:{ticketId:ticket.id,role:{in:['GROOMER','PLANNED_GROOMER']}}});if(body.groomerId)await tx.ticketAssignment.createMany({data:[{ticketId:ticket.id,userId:body.groomerId,role:'GROOMER'},{ticketId:ticket.id,userId:body.groomerId,role:'PLANNED_GROOMER'}]});}
    const changed = await tx.ticket.update({ where: { id: ticket.id }, data: { scheduledStart: newStart } });
    await tx.ticketScheduleHistory.create({ data: { tenantId, ticketId: ticket.id, actorUserId: session.user.id, changeType: "MOVED", previousStart, newStart } });
    return changed;
  });
  await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "TICKET", entityId: ticket.id, customerId: ticket.customerId, action: "MOVE", summary: `Moved appointment #${ticket.orderNumber} from ${previousStart?.toLocaleString()||"unscheduled"} to ${newStart.toLocaleString()}.`, details: { previousStart: previousStart?.toISOString()||null, newStart: newStart.toISOString() } });
  await reconcileEmployeeAssignments(tenantId);
  return NextResponse.json({ ticket: updated, moved: true, previousStart, newStart });
}

